import { insertRecord } from "../../../common/src/database/insert-record";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { updateRecordBySessionId } from "../../../common/src/database/update-record-by-session-id";
import { UnixTimestamp } from "../../../common/src/types/brands";
import {
  FailedAuthError,
  FailedMatchError,
  PdvApiError,
  PersonDeceasedError,
} from "../hmrc-apis/exceptions/pdv";
import { getTokenFromOtg } from "../hmrc-apis/otg";
import { matchUserDetailsWithPdv } from "../hmrc-apis/pdv";
import { OtgTokenResponse } from "../hmrc-apis/types/otg";
import { PdvFunctionOutput } from "../hmrc-apis/types/pdv";
import { AttemptItem } from "../types/attempt";
import { Helpers, NinoCheckConfig } from "../types/input";
import { NinoSessionItem } from "../types/nino-session-item";

export async function validateNino(
  { hmrcApiConfig, tableNames }: NinoCheckConfig,
  { logHelper, metricsHelper }: Helpers,
  personIdentity: PersonIdentityItem,
  session: SessionItem,
  nino: string
): Promise<{ ninoMatch: boolean }> {
  const { logger } = logHelper;
  const { sessionId } = session;

  let otgRes: OtgTokenResponse;
  try {
    otgRes = await getTokenFromOtg(hmrcApiConfig.otg, logger, metricsHelper);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logHelper.logError(message);
    throw error;
  }

  logger.info(`Successfully retrieved OAuth token from HMRC`);

  // TODO: put IPV_HMRC_RECORD_CHECK_CRI_REQUEST_SENT on audit event bus

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
    const message = error instanceof Error ? error.message : String(error);
    logHelper.logError(message);
    throw error;
  }

  if (pdvRes.httpStatus >= 400) {
    if (pdvRes.httpStatus === 424) {
      metricsHelper.captureMetric(`DeceasedUserMetric`);
      throw new PersonDeceasedError();
    } else if (
      pdvRes.httpStatus === 401 &&
      "errors" in (pdvRes.parsedBody ?? {})
    ) {
      // when implementing retry, add RetryAttemptsSentMetric here
      throw new FailedMatchError(sessionId);
    }

    // TODO: This doesn't seem to match API docs... unless I'm looking at the wrong API
    // https://github.com/hmrc/personal-details-validation
    else if (
      pdvRes.parsedBody &&
      "code" in pdvRes.parsedBody &&
      pdvRes.parsedBody?.code === "INVALID_CREDENTIALS"
    ) {
      metricsHelper.captureMetric(`FailedHMRCAuthMetric`);
      throw new FailedAuthError();
    }
    metricsHelper.captureMetric(`HMRCAPIErrorMetric`);
    throw new PdvApiError(pdvRes.httpStatus);
  } else {
    metricsHelper.captureMetric(`SuccessfulFirstAttemptMetric`);
  }

  logger.info(`User details matched with status ${pdvRes.httpStatus}.`);

  const txnRes = await updateRecordBySessionId<NinoSessionItem>(
    tableNames.sessionTable,
    { sessionId, txn: pdvRes.txn },
    logger
  );

  logger.info(
    `Saved txn to session table: ${txnRes.$metadata.httpStatusCode}.`
  );

  // TODO: put IPV_HMRC_RECORD_CHECK_CRI_RESPONSE_RECEIVED on audit event bus

  const attemptRes = await insertRecord<AttemptItem>(
    tableNames.attemptTable,
    {
      sessionId,
      timestamp: logHelper.handlerStartTime,
      attempt: "PASS",
      ttl: session.expiryDate as UnixTimestamp,
    },
    logger
  );

  logger.info(`Saved attempt: ${attemptRes.$metadata.httpStatusCode}`);

  return { ninoMatch: true };
}
