import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { BaseFunctionConfig } from "../../common/src/config/base-function-config";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "../../common/src/util/logger";
import { retrieveSessionByAccessToken } from "./helpers/retrieve-session-by-access-token";
import { metrics } from "../../common/src/util/metrics";
import { countAttempts } from "../../common/src/database/count-attempts";
import { retrieveNinoUser } from "./helpers/retrieve-nino-user";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { getRecordBySessionId } from "../../common/src/database/get-record-by-session-id";

initOpenTelemetry();

const dynamoClient = new DynamoDBClient();

const functionConfig = new BaseFunctionConfig();

class IssueCredentialHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  public async handler({ headers }: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`${context.functionName} invoked.`);

      const accessToken = (headers["Authorization"]?.match(/^Bearer [a-zA-Z0-9_-]+$/) ?? [])[0];

      if (!accessToken) throw new CriError(400, "You must provide a valid access token");

      const session = await retrieveSessionByAccessToken(
        functionConfig.tableNames.sessionTable,
        dynamoClient,
        accessToken
      );

      logger.appendKeys({
        govuk_signin_journey_id: session.clientSessionId,
      });
      logger.info(`Identified government journey id: ${session.clientSessionId}`);

      const failedAttemptCount = await countAttempts(
        functionConfig.tableNames.attemptTable,
        dynamoClient,
        session.sessionId,
        "FAIL"
      );
      logger.info(`Identified ${failedAttemptCount} failed attempts.`);

      const personIdentity = await getRecordBySessionId(
        dynamoClient,
        functionConfig.tableNames.personIdentityTable,
        session.sessionId,
        "expiryDate"
      );
      logger.info(`Retrieved person identity.`);

      const ninoUser = await retrieveNinoUser(functionConfig.tableNames.ninoUserTable, dynamoClient, session.sessionId);
      logger.info(`Retrieved NINo-user entry.`);

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
