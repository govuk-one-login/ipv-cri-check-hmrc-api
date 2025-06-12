import { LambdaInterface } from "@aws-lambda-powertools/commons";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { NinoCheckHandler } from "nino-check-function/src/nino-check-handler";
import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import {
  isSessionExpired,
  querySession,
} from "nino-check-function/src/session-check";
import { SessionItem } from "nino-check-function/src/session-item";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const eventBridgeClient = new EventBridgeClient({});

export class AbandonHandler implements LambdaInterface {
  public async handler(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`Entry ${context.functionName}`);

      const sessionId = event.headers["session-id"] ?? "";
      const sessionItem = await fetchSessionRecord(sessionId);
      if (!sessionItem || isSessionExpired(sessionItem)) {
        logger.info("Session expired for session-id: " + sessionId);
        return http400();
      }

      const userAuditInfo: Record<string, string> = {
        govuk_signin_journey_id: sessionItem.clientSessionId,
        ip_address: sessionItem.clientIpAddress,
        session_id: sessionId,
        user_id: sessionItem.subject,
      };
      if (sessionItem.persistentSessionId) {
        userAuditInfo.persistent_session_id = sessionItem.persistentSessionId;
      }

      const txmaAuditHeader = event.headers["txma-audit-encoded"];

      logger.info("Removing authorizationCode for session: " + sessionId);

      await dynamoClient.send(
        new UpdateItemCommand({
          TableName: process.env.SessionTableName,
          Key: {
            sessionId: { S: sessionId },
          },
          UpdateExpression:
            "SET authorizationCodeExpiryDate = :expiry REMOVE authorizationCode",
          ExpressionAttributeValues: {
            ":expiry": { N: "0" },
          },
        })
      );

      await eventBridgeClient.send(
        new PutEventsCommand({
          Entries: [
            {
              Detail: JSON.stringify({
                auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
                user: userAuditInfo,
                deviceInformation: txmaAuditHeader,
                issuer: ssmParameters.Issuer,
              }),
              DetailType: "ABANDONED",
              EventBusName: "preview-check-hmrc-api-oj-2958-CheckHmrcEventBus",
              Source: "review-hc.localdev.account.gov.uk",
            },
          ],
        })
      );

      return http200();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("An error occurred inside nino-check-handler: " + message);
      return http500();
    }
  }
}

async function fetchSessionRecord(sessionId: string) {
  logger.info("Checking session " + sessionId);

  if (!sessionId) {
    return null;
  }

  const sessionQuery = await querySession(sessionId);
  if ((sessionQuery.Count || 0) <= 0) {
    logger.info("No session item found for session-id: " + sessionId);
    return null;
  }

  const sessionQueryResult = sessionQuery.Items?.map((item) => ({
    sessionId: item.sessionId.S,
    clientSessionId: item.clientSessionId.S,
    clientIpAddress: item.clientIpAddress.S,
    subject: item.subject.S,
    clientId: item.clientId.S,
    expiryDate: item.expiryDate.N,
    persistentSessionId: item.persistentSessionId?.S,
  }));

  return (sessionQueryResult ? sessionQueryResult[0] : null) as SessionItem;
}

function http400() {
  return {
    statusCode: 400,
    body: "",
  };
}

function http500() {
  return {
    statusCode: 500,
    body: "",
  };
}

function http200() {
  return {
    statusCode: 200,
    body: "",
  };
}

const handlerClass = new NinoCheckHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
