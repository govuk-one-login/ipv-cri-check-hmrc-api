import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import { CriError } from "../../../common/src/errors/cri-error";
import { logger } from "../../../common/src/util/logger";

const dynamoClient = new DynamoDBClient();

export async function retrieveSessionRecord(sessionTableName: string, sessionId: string) {
  try {
    const sessionItem = await getRecordBySessionId<SessionItem>(
      dynamoClient,
      sessionTableName,
      sessionId,
      "expiryDate"
    );
    return sessionItem;
  } catch (error: unknown) {
    if (error instanceof RecordNotFoundError) {
      throw new CriError(400, "Session not found");
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
