import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { BaseFunctionConfig } from "../../common/src/config/base-function-config";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { logger } from "../../common/src/util/logger";
import { retrieveSessionIdByAccessToken } from "./helpers/retrieve-session-by-access-token";
import { metrics } from "../../common/src/util/metrics";
import { countAttempts } from "../../common/src/database/count-attempts";
import { retrieveNinoUser } from "./helpers/retrieve-nino-user";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { dynamoDBClient } from "../../common/src/util/dynamo";

initOpenTelemetry();

const functionConfig = new BaseFunctionConfig();

class IssueCredentialHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  public async handler({ headers }: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`${context.functionName} invoked.`);

      const accessToken = (headers["Authorization"]?.match(/^Bearer [a-zA-Z0-9_-]+$/) ?? [])[0];

      if (!accessToken) throw new CriError(400, "You must provide a valid access token");

      const sessionId = await retrieveSessionIdByAccessToken(
        functionConfig.tableNames.sessionTable,
        dynamoDBClient,
        accessToken
      );
      logger.info("Successfully retrieved the session id.");

      const session = await getSessionBySessionId(functionConfig.tableNames.sessionTable, sessionId);

      logger.appendKeys({
        govuk_signin_journey_id: session.clientSessionId,
      });
      logger.info("Successfully retrieved the session record.");

      const failedAttemptCount = await countAttempts(
        functionConfig.tableNames.attemptTable,
        dynamoDBClient,
        session.sessionId,
        "FAIL"
      );
      logger.info(`Identified ${failedAttemptCount} failed attempts.`);

      const personIdentity = await getRecordBySessionId(
        dynamoDBClient,
        functionConfig.tableNames.personIdentityTable,
        session.sessionId,
        "expiryDate"
      );
      logger.info("Successfully retrieved the person identity record.");

      const ninoUser = await retrieveNinoUser(
        functionConfig.tableNames.ninoUserTable,
        dynamoDBClient,
        session.sessionId
      );
      logger.info("Successfully retrieved the nino user record.");

      return {
        statusCode: 200,
        body: JSON.stringify({ failedAttemptCount, personIdentity, ninoUser }),
      };
    } catch (error) {
      return handleErrorResponse(error, logger);
    }
  }
}

const handlerClass = new IssueCredentialHandler();
export const handler = handlerClass.handler.bind(handlerClass);
