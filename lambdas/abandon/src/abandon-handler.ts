import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { AbandonHandlerConfig } from "./config/abandon-handler-config";
import { removeAuthCodeFromSessionRecord } from "./services/abandon-dynamo-service";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { logger } from "../../common/src/util/logger";
import { getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { sendAuditEvent } from "../../common/src/util/audit";
import { ABANDONED } from "../../common/src/types/audit";

initOpenTelemetry();

export class AbandonHandler implements LambdaInterface {
  readonly config: AbandonHandlerConfig;

  constructor() {
    this.config = new AbandonHandlerConfig();
  }

  @logger.injectLambdaContext({ resetKeys: true })
  public async handler(_: APIGatewayProxyEvent, _: Context): Promise<APIGatewayProxyResult> {
    throw new Error("test");
  }
}

const handlerClass = new AbandonHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
