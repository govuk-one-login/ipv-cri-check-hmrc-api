import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { insertRecord } from "../../../common/src/database/insert-record";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { updateRecordBySessionId } from "../../../common/src/database/update-record-by-session-id";
import { UnixTimestamp } from "../../../common/src/types/brands";
import { FailedAuthError, FailedMatchError, PdvApiError, PersonDeceasedError } from "../hmrc-apis/exceptions/pdv";
import { getTokenFromOtg } from "../hmrc-apis/otg";
import { matchUserDetailsWithPdv } from "../hmrc-apis/pdv";
import { OtgConfig, OtgTokenResponse } from "../hmrc-apis/types/otg";
import { PdvConfig, PdvFunctionOutput } from "../hmrc-apis/types/pdv";
import { AttemptItem } from "../types/attempt";
import { Helpers, HmrcEnvVars, NinoCheckFunctionConfig } from "../types/input";
import { NinoSessionItem } from "../types/nino-session-item";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { marshall } from "@aws-sdk/util-dynamodb";

export type HmrcApiConfig = {
  otg: OtgConfig;
  pdv: PdvConfig;
};

export type AuditUser = {
  govuk_signin_journey_id: string;
  ip_address: string;
  session_id: string;
  user_id: string;
  persistent_session_id?: string;
};

const cacheTtlInSeconds = Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;

async function getHmrcConfig(clientId: string, { pdvUserAgentParamName }: HmrcEnvVars): Promise<HmrcApiConfig> {
  const otgParamName = `/check-hmrc-cri-api/OtgUrl/${clientId}`;
  const pdvParamName = `/check-hmrc-cri-api/NinoCheckUrl/${clientId}`;

  const { _errors: errors, ...ssmParams } = await getParametersByName<string>(
    {
      [otgParamName]: {},
      [pdvParamName]: {},
      [pdvUserAgentParamName]: {},
    },
    { maxAge: cacheTtlInSeconds, throwOnError: false }
  );

  if (errors?.length) {
    const errorMessage = `Following SSM parameters do not exist: ${errors.join(", ")}`;
    throw new Error(errorMessage);
  }

  return {
    otg: {
      apiUrl: ssmParams[otgParamName],
    },
    pdv: {
      apiUrl: ssmParams[pdvParamName],
      userAgent: ssmParams[pdvUserAgentParamName],
    },
  };
}

export async function validateNino(
  clientId: string,
  { tableNames, audit: auditConfig, hmrcApi: hmrcEnvVars }: NinoCheckFunctionConfig,
  { logHelper, metricsHelper, eventsClient, dynamoClient }: Helpers,
  personIdentity: PersonIdentityItem,
  session: SessionItem,
  nino: string
): Promise<{ ninoMatch: boolean }> {
  const hmrcApiConfig = await getHmrcConfig(clientId, hmrcEnvVars);

  const { logger } = logHelper;
  const { sessionId } = session;

  let otgRes: OtgTokenResponse;
  try {
    otgRes = await getTokenFromOtg(hmrcApiConfig.otg, logger, metricsHelper);
  } catch (error: unknown) {
    const message = String(error);
    logHelper.logError(message);
    throw error;
  }

  const auditUser: AuditUser = {
    govuk_signin_journey_id: session.clientSessionId,
    ip_address: session.clientIpAddress,
    session_id: session.sessionId,
    user_id: session.subject,
    persistent_session_id: session.persistentSessionId,
  };

  logger.info(`Successfully retrieved OAuth token from HMRC. Proceeding with PDV request...`);

  await eventsClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Detail: JSON.stringify({
            auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
            user: auditUser,
            deviceInformation: auditConfig.deviceInformation,
            nino,
            // marshall the person identity for consistency with the step function that came before this Lambda
            userInfoEvent: marshall(personIdentity),
            issuer: auditConfig.issuer,
          }),
          DetailType: "REQUEST_SENT",
          EventBusName: auditConfig.eventBus,
          Source: auditConfig.source,
        },
      ],
    })
  );

  let pdvRes: PdvFunctionOutput;
  try {
    pdvRes = await matchUserDetailsWithPdv(
      hmrcApiConfig.pdv,
      otgRes.token,
      personIdentity,
      nino,
      logger,
      metricsHelper
    );
  } catch (error: unknown) {
    const message = String(error);
    logHelper.logError(message);
    throw error;
  }

  if (pdvRes.httpStatus >= 400) {
    if (pdvRes.httpStatus === 424) {
      metricsHelper.captureMetric(`DeceasedUserMetric`);
      throw new PersonDeceasedError();
    } else if (pdvRes.httpStatus === 401 && "errors" in (pdvRes.parsedBody ?? {})) {
      metricsHelper.captureMetric(`RetryAttemptsSentMetric`);
      throw new FailedMatchError(sessionId);
    } else if (pdvRes.parsedBody && "code" in pdvRes.parsedBody && pdvRes.parsedBody?.code === "INVALID_CREDENTIALS") {
      metricsHelper.captureMetric(`FailedHMRCAuthMetric`);
      throw new FailedAuthError();
    }
    metricsHelper.captureMetric(`HMRCAPIErrorMetric`);
    throw new PdvApiError(pdvRes.httpStatus);
  } else {
    metricsHelper.captureMetric(`SuccessfulFirstAttemptMetric`);
  }

  logger.info(`User details matched with status ${pdvRes.httpStatus}.`);

  const { txn } = pdvRes;

  const txnRes = await updateRecordBySessionId<NinoSessionItem>(
    tableNames.sessionTable,
    { sessionId, txn },
    logger,
    dynamoClient
  );

  logger.info(`Saved txn to session table: ${txnRes.$metadata.httpStatusCode}.`);

  await eventsClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Detail: JSON.stringify({
            auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
            user: auditUser,
            deviceInformation: auditConfig.deviceInformation,
            issuer: auditConfig.issuer,
            evidence: [{ txn }],
          }),
          DetailType: "RESPONSE_RECEIVED",
          EventBusName: auditConfig.eventBus,
          Source: auditConfig.source,
        },
      ],
    })
  );

  const attemptRes = await insertRecord<AttemptItem>(
    tableNames.attemptTable,
    {
      sessionId,
      timestamp: logHelper.handlerStartTime,
      attempt: "PASS",
      ttl: session.expiryDate as UnixTimestamp,
    },
    logger,
    dynamoClient
  );

  logger.info(`Saved attempt: ${attemptRes.$metadata.httpStatusCode}`);

  return { ninoMatch: true };
}
