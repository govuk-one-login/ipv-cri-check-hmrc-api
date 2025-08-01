import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { AbandonHandlerConfig } from "./config/abandon-handler-config";
import { removeAuthCodeFromSessionRecord } from "./services/abandon-dynamo-service";
import { CriError } from "../../common/src/errors/cri-error";
import { sendAbandonedAuditEvent } from "./services/abandon-audit-service";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { logger } from "../../common/src/util/logger";
import { getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";

initOpenTelemetry();

export class AbandonHandler implements LambdaInterface {
  readonly config: AbandonHandlerConfig;

  constructor() {
    this.config = new AbandonHandlerConfig();
  }

  @logger.injectLambdaContext({ resetKeys: true })
  public async handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`${context.functionName} invoked`);

      const txmaAuditHeader = event.headers["txma-audit-encoded"];
      const sessionId = event.headers["session-id"];
      if (!sessionId) {
        throw new CriError(400, "No session-id header present");
      }

      const sessionItem = await getSessionBySessionId(this.config.sessionTableName, sessionId);

      logger.appendKeys({
        govuk_signin_journey_id: sessionItem.clientSessionId,
      });
      logger.info("Successfully retrieved the session record.");

      await removeAuthCodeFromSessionRecord(this.config.sessionTableName, sessionId);

      await sendAbandonedAuditEvent(this.config, sessionItem, txmaAuditHeader);

      return {
        statusCode: 200,
        body: "",
      };
    } catch (error: unknown) {
      return handleErrorResponse(error, logger);
    }
  }
}

const handlerClass = new AbandonHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
