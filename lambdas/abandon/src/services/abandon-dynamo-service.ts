import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { logger } from "../../../common/src/util/logger";
import { dynamoDBClient } from "../../../common/src/util/dynamo";

export async function removeAuthCodeFromSessionRecord(sessionTableName: string, sessionId: string) {
  await dynamoDBClient.send(
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
