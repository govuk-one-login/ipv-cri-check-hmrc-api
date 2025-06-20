import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { main } from "./main";
import { Helpers } from "./types/input";
import { LogHelper } from "../../logging/log-helper";
import { MetricsHelper } from "../../logging/metrics-helper";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const helpers: Helpers = {
    logHelper: new LogHelper(context),
    metricsHelper: new MetricsHelper(),
    eventsClient: new EventBridgeClient(),
    dynamoClient: new DynamoDBClient(),
  };

  try {
    return await main(event, helpers);
  } catch (error) {
    return handleErrorResponse(error, helpers.logHelper.logger);
  }
}
