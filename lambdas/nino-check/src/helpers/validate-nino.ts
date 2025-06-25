import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { UnixTimestamp } from "../../../common/src/types/brands";
import { getTokenFromOtg } from "../hmrc-apis/otg";
import { buildPdvInput, matchUserDetailsWithPdv } from "../hmrc-apis/pdv";
import { OtgConfig } from "../hmrc-apis/types/otg";
import { PdvConfig } from "../hmrc-apis/types/pdv";
import { Helpers, HmrcEnvVars } from "../types/input";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { marshall } from "@aws-sdk/util-dynamodb";
import { CriError } from "../../../common/src/errors/cri-error";
import { NinoCheckFunctionConfig } from "./function-config";
import { PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { AttemptItem } from "../types/attempt";

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
  { logger, metricsHelper, eventsClient, dynamoClient, functionStartTime }: Helpers,
  personIdentity: PersonIdentityItem,
  session: SessionItem,
  nino: string
): Promise<{ ninoMatch: boolean }> {
  const hmrcApiConfig = await getHmrcConfig(clientId, hmrcEnvVars);

  const { sessionId } = session;

  const otgRes = await getTokenFromOtg(hmrcApiConfig.otg, logger, metricsHelper);

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
            userInfoEvent: { Items: [marshall(personIdentity)], Count: 1 },
            issuer: auditConfig.issuer,
          }),
          DetailType: "REQUEST_SENT",
          EventBusName: auditConfig.eventBus,
          Source: auditConfig.source,
        },
      ],
    })
  );

  const pdvInput = buildPdvInput(personIdentity, nino);

  const pdvRes = await matchUserDetailsWithPdv(hmrcApiConfig.pdv, otgRes.token, pdvInput, logger, metricsHelper);

  if (pdvRes.httpStatus !== 200) {
    if (pdvRes.httpStatus === 424) {
      metricsHelper.captureMetric(`DeceasedUserMetric`);
      logger.info(`Deceased response received`);
    } else if (pdvRes.httpStatus === 401 && "errors" in (pdvRes.parsedBody ?? {})) {
      metricsHelper.captureMetric(`RetryAttemptsSentMetric`);
      logger.info(`Failed PDV match received.`);
    } else if (pdvRes.parsedBody && "code" in pdvRes.parsedBody && pdvRes.parsedBody?.code === "INVALID_CREDENTIALS") {
      metricsHelper.captureMetric(`FailedHMRCAuthMetric`);
      logger.info(`Failed to authenticate with HMRC API: response had a code of ${pdvRes.parsedBody.code}`);
      throw new CriError(500, "Failed to authenticate with HMRC API");
    } else {
      metricsHelper.captureMetric(`HMRCAPIErrorMetric`);
      logger.info(`Received an unexpected error response from the PDV API - status: ${pdvRes.httpStatus}`);
      throw new CriError(500, "Unexpected error with the PDV API");
    }
  } else {
    metricsHelper.captureMetric(`SuccessfulFirstAttemptMetric`);
  }

  logger.info(`User details matched with status ${pdvRes.httpStatus}.`);

  const txnCmd = new UpdateItemCommand({
    TableName: tableNames.sessionTable,
    Key: marshall({ sessionId }),
    UpdateExpression: `SET txn=:txn`,
    ExpressionAttributeValues: marshall({ ":txn": pdvRes.txn }),
  });

  const txnRes = await dynamoClient.send(txnCmd);

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
            evidence: [{ txn: pdvRes.txn }],
          }),
          DetailType: "RESPONSE_RECEIVED",
          EventBusName: auditConfig.eventBus,
          Source: auditConfig.source,
        },
      ],
    })
  );

  const newAttempt: AttemptItem = {
    sessionId,
    timestamp: functionStartTime,
    attempt: "PASS",
    ttl: session.expiryDate as UnixTimestamp,
  };

  const putAttemptCmd = new PutItemCommand({
    TableName: tableNames.attemptTable,
    Item: marshall(newAttempt),
  });

  const attemptRes = await dynamoClient.send(putAttemptCmd);

  logger.info(`Saved attempt: ${attemptRes.$metadata.httpStatusCode}`);

  return { ninoMatch: pdvRes.httpStatus === 200 };
}
