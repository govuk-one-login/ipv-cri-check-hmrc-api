import { Context } from "aws-lambda";
import { LogHelper } from "../../logging/log-helper";
import { MetricsHelper } from "../../logging/metrics-helper";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { issueAuthorizationCode } from "./steps/3-issue-authorization-code";
import { InputEvent } from "./types/input";
import { getConfig } from "./steps/0-config";
import { getSessionInfo } from "./steps/1-get-session-info";
import { validateNino } from "./steps/2-validate-nino";
import { TooManyAttemptsError } from "./exceptions/errors";
import {
  RecordExpiredError,
  RecordNotFoundError,
} from "../../common/src/database/exceptions/errors";
import { SessionItem } from "../../common/src/database/types/session-item";
import { PersonIdentityItem } from "../../common/src/database/types/person-identity";
import {
  FailedAuthError,
  FailedMatchError,
  PdvApiError,
  PersonDeceasedError,
} from "./hmrc-apis/exceptions/pdv";

initOpenTelemetry();

const metricsHelper = new MetricsHelper();

export async function handler(
  { sessionId, govJourneyId, nino, clientId }: InputEvent,
  context: Context
): Promise<{ statusCode: number; body?: { requestRetry: boolean } }> {
  const helpers = {
    logHelper: new LogHelper(context, govJourneyId),
    metricsHelper,
  };
  helpers.logHelper.logEntry();
  const { logger } = helpers.logHelper;

  const config = getConfig(clientId);
  const { tableNames } = config;

  logger.info(`Getting person & session data...`);

  let session: SessionItem;
  let personIdentity: PersonIdentityItem;
  let isFinalAttempt: boolean;

  try {
    ({ session, personIdentity, isFinalAttempt } = await getSessionInfo(
      tableNames,
      helpers,
      sessionId
    ));
  } catch (error) {
    if (error instanceof RecordExpiredError) {
      metricsHelper.captureMetric(`InvalidSessionErrorMetric`);
      return { statusCode: 400 };
    } else if (error instanceof RecordNotFoundError) {
      // TODO: should this be a 400 or 500?
      // docs state 400: https://govukverify.atlassian.net/wiki/spaces/OJ/pages/3739549733/Working+with+the+HMRC+NINo+Check+CRI+API+REVIEW#Flow-returns-to-NinoCheck-state-machine
      // but state machine returns 500
      // TODO: should we have a metric captured here?
      return { statusCode: 500 };
    } else if (error instanceof TooManyAttemptsError) {
      metricsHelper.captureMetric(`AttemptsExceededMetric`);
      return { statusCode: 200, body: { requestRetry: false } };
    }

    throw error;
  }

  logger.info(
    `Retrieved session and person identity. isFinalAttempt=${isFinalAttempt}. Validating provided NINo information...`
  );

  let ninoMatch: boolean;

  try {
    ({ ninoMatch } = await validateNino(
      config,
      helpers,
      personIdentity,
      session,
      nino
    ));
  } catch (error) {
    if (error instanceof PdvApiError) {
      return { statusCode: 500 };
    } else if (error instanceof FailedMatchError) {
      ninoMatch = false;
    } else if (error instanceof PersonDeceasedError) {
      ninoMatch = false;
    } else if (error instanceof FailedAuthError) {
      throw error;
    } else {
      metricsHelper.captureMetric(`MatchingLambdaErrorMetric`);
      throw error;
    }
  }

  logger.info(`Completed NINo verification - ninoMatch=${ninoMatch}.`);

  if (ninoMatch || isFinalAttempt) {
    logger.info(`No need for further retries. Issuing authorization code...`);

    await issueAuthorizationCode(tableNames, logger, sessionId, nino);

    return { statusCode: 200, body: { requestRetry: false } };
  } else {
    logger.info(
      `Failed to verify. This was not the last attempt - requesting the user retries.`
    );

    return { statusCode: 200, body: { requestRetry: true } };
  }
}
