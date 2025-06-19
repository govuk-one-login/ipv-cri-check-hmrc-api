import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { RecordExpiredError, RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import { CriError } from "../../../common/src/errors/cri-error";
import { logger } from "../../../common/src/util/logger";

const dynamoClient = new DynamoDBClient();

export async function retrieveSessionRecord(sessionTableName: string, sessionId: string) {
  try {
    const sessionItems = await getRecordBySessionId<SessionItem>(sessionTableName, sessionId, logger, dynamoClient);
    if (sessionItems.length > 1) {
      logger.warn("Multiple sessions found for session id");
    }
    return sessionItems[0];
  } catch (error: unknown) {
    if (error instanceof RecordNotFoundError) {
      throw new CriError(400, "Session not found");
    }
    if (error instanceof RecordExpiredError) {
      throw new CriError(400, "Session expired");
    }
    throw error;
  }
}

export async function removeAuthCodeFromSessionRecord(sessionTableName: string, sessionId: string) {
  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: sessionTableName,
      Key: {
        sessionId: { S: sessionId },
      },
      UpdateExpression: "SET authorizationCodeExpiryDate = :expiry REMOVE authorizationCode",
      ExpressionAttributeValues: {
        ":expiry": { N: "0" },
      },
    })
  );
  logger.info("Removed auth code from the session.");
}
