import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { issueAuthorizationCode } from "./steps/3-issue-authorization-code";
import { getConfig } from "./steps/0-get-config";
import { getSessionInfo } from "./steps/1-get-session-info";
import { validateNino } from "./steps/2-validate-nino";
import { TooManyAttemptsError } from "./exceptions/errors";
import { RecordExpiredError, RecordNotFoundError } from "../../common/src/database/exceptions/errors";
import { SessionItem } from "../../common/src/database/types/session-item";
import { PersonIdentityItem } from "../../common/src/database/types/person-identity";
import { FailedAuthError, FailedMatchError, PdvApiError, PersonDeceasedError } from "./hmrc-apis/exceptions/pdv";
import { Helpers, InputBody } from "./types/input";
import { CriError } from "../../common/src/errors/cri-error";

initOpenTelemetry();

function processEvent({ body, headers }: APIGatewayProxyEvent): {
  nino: string;
  sessionId: string;
  deviceInformationHeader?: string;
} {
  const sessionId = headers["session-id"];
  if (!sessionId) throw new CriError(500, `No sessionId found on request!`);
  const deviceInformationHeader = headers["txma-audit-encoded"];

  if (!body) throw new CriError(500, `No body found on request!`);
  const { nino } = JSON.parse(body) as InputBody;
  if (!nino) throw new CriError(500, `Failed to retrieve NINo from body!`);

  return { sessionId, nino, deviceInformationHeader };
}

export async function main(event: APIGatewayProxyEvent, helpers: Helpers): Promise<APIGatewayProxyResult> {
  const { logger } = helpers.logHelper;

  const { nino, sessionId, deviceInformationHeader } = processEvent(event);

  const functionConfig = getConfig({ deviceInformationHeader });
  const { tableNames } = functionConfig;

  logger.info(`Getting person & session data...`);

  let session: SessionItem;
  let personIdentity: PersonIdentityItem;
  let isFinalAttempt: boolean;

  try {
    ({ session, personIdentity, isFinalAttempt } = await getSessionInfo(tableNames, helpers, sessionId));
  } catch (error) {
    if (error instanceof RecordExpiredError) {
      helpers.metricsHelper.captureMetric(`InvalidSessionErrorMetric`);
      throw new CriError(
        400,
        `Expired record(s) in ${error.tableName} (expir[y/ies]: ${error.expiryDates.join(", ")})`
      );
    } else if (error instanceof RecordNotFoundError) {
      throw new CriError(500, `No ${error.tableName} record found with sessionId '${error.sessionId}'`);
    } else if (error instanceof TooManyAttemptsError) {
      helpers.metricsHelper.captureMetric(`AttemptsExceededMetric`);
      logger.info(`Caught TooManyAttemptsError. Returning requestRetry: false.`);
      return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
    }

    logger.info(`Caught unexpected session info function error: ${String(error)}`);

    throw new CriError(500, "Unexpected error getting session information");
  }

  const { clientId, clientSessionId: govJourneyId } = session;

  helpers.logHelper.logEntry(govJourneyId);

  logger.info(
    `Retrieved session and person identity. isFinalAttempt=${isFinalAttempt}. Validating provided NINo information...`
  );

  let ninoMatch: boolean;

  try {
    ({ ninoMatch } = await validateNino(clientId, functionConfig, helpers, personIdentity, session, nino));
  } catch (error) {
    if (error instanceof PdvApiError) {
      throw new CriError(500, "Unexpected error with the PDV API");
    } else if (error instanceof FailedMatchError || error instanceof PersonDeceasedError) {
      ninoMatch = false;
    } else if (error instanceof FailedAuthError) {
      throw new CriError(500, "Failed to authenticate with HMRC API");
    } else {
      helpers.metricsHelper.captureMetric(`MatchingLambdaErrorMetric`);

      logger.info(`Caught unexpected NINo function error: ${String(error)}`);

      throw new CriError(500, "Unexpected error when validating NINo");
    }
  }

  logger.info(`Completed NINo verification - ninoMatch=${ninoMatch}.`);

  if (ninoMatch || isFinalAttempt) {
    logger.info(`No need for further retries. Issuing authorization code...`);

    try {
      await issueAuthorizationCode(tableNames, helpers, sessionId, nino);
    } catch (error) {
      logger.info(`Caught error issuing auth code: ${String(error)}`);

      throw new CriError(500, `Failed to issue authorization code`);
    }

    return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
  } else {
    logger.info(`Failed to verify. This was not the last attempt - requesting the user retries.`);

    return { statusCode: 200, body: JSON.stringify({ requestRetry: true }) };
  }
}
