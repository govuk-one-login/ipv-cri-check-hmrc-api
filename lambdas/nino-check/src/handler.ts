import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { addAuthCodeToSession } from "./helpers/add-auth-code-to-session";
import { NinoCheckFunctionConfig } from "./helpers/function-config";
import { getSessionInfo } from "./helpers/get-session-info";
import { validateNino } from "./helpers/validate-nino";
import { TooManyAttemptsError } from "./exceptions/errors";
import { RecordExpiredError, RecordNotFoundError } from "../../common/src/database/exceptions/errors";
import { SessionItem } from "../../common/src/database/types/session-item";
import { PersonIdentityItem } from "../../common/src/database/types/person-identity";
import { Helpers, InputBody } from "./types/input";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricsHelper } from "../../logging/metrics-helper";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ISO8601DateString } from "../../common/src/types/brands";

initOpenTelemetry();

const logger = new Logger();

function processEvent({ body, headers }: APIGatewayProxyEvent): {
  nino: string;
  sessionId: string;
  deviceInformationHeader?: string;
} {
  const sessionId = headers["session-id"] as string;
  const deviceInformationHeader = headers["txma-audit-encoded"];

  const { nino } = JSON.parse(body as string) as InputBody;

  return { sessionId, nino, deviceInformationHeader };
}

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  try {
    logger.addContext(context);

    const helpers: Helpers = {
      logger,
      metricsHelper: new MetricsHelper(),
      eventsClient: new EventBridgeClient(),
      dynamoClient: new DynamoDBClient(),
      functionStartTime: new Date().toISOString() as ISO8601DateString,
    };

    const { nino, sessionId, deviceInformationHeader } = processEvent(event);

    const functionConfig = new NinoCheckFunctionConfig({ deviceInformationHeader });
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
        logger.info(`Expired record(s) in ${error.tableName} (expir[y/ies]: ${error.expiryDates.join(", ")})`);
        throw new CriError(400, "Failed to find a valid record for the given session ID.");
      } else if (error instanceof RecordNotFoundError) {
        logger.info(`No valid ${error.tableName} record found.`);
        if (error.tableName === tableNames.sessionTable) {
          throw new CriError(400, `No valid session entry found for the given id`);
        } else {
          throw new CriError(500, `Failed to find valid entries for the given session id`);
        }
      } else if (error instanceof TooManyAttemptsError) {
        helpers.metricsHelper.captureMetric(`AttemptsExceededMetric`);
        logger.info(`Caught TooManyAttemptsError. Returning requestRetry: false.`);
        return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
      }

      logger.info(`Caught unexpected session info function error: ${String(error)}`);

      throw new CriError(500, "Unexpected error getting session information");
    }

    const { clientId, clientSessionId: govJourneyId } = session;

    logger.appendKeys({
      govuk_signin_journey_id: govJourneyId,
    });
    logger.info(`${context.functionName} invoked with government journey id: ${govJourneyId}`);

    logger.info(
      `Retrieved session and person identity. isFinalAttempt=${isFinalAttempt}. Validating provided NINo information...`
    );

    let ninoMatch: boolean;

    try {
      ({ ninoMatch } = await validateNino(clientId, functionConfig, helpers, personIdentity, session, nino));
    } catch (error) {
      if (error instanceof CriError) {
        throw error;
      }

      helpers.metricsHelper.captureMetric(`MatchingLambdaErrorMetric`);

      logger.error({
        message: `Error in ${context.functionName}: ${String(error)}`,
        govuk_signin_journey_id: govJourneyId,
      });

      throw new CriError(500, "Unexpected error when validating NINo");
    }

    logger.info(`Completed NINo verification - ninoMatch=${ninoMatch}.`);

    if (ninoMatch || isFinalAttempt) {
      logger.info(`No need for further retries. Issuing authorization code...`);

      await addAuthCodeToSession(tableNames, helpers, sessionId, nino);

      return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
    }

    logger.info(`Failed to verify. This was not the last attempt - requesting the user retries.`);

    return { statusCode: 200, body: JSON.stringify({ requestRetry: true }) };
  } catch (error) {
    return handleErrorResponse(error, logger);
  } finally {
    // remove govJourneyId and any other appended keys from the logger, ready for any future calls
    logger.resetKeys();
  }
}
