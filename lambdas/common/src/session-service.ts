import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SessionItem } from "./session-item";
import { SessionNotFoundError } from "./exceptions/errors";
import { withRetry } from "./util/retry";

const dynamoClient = new DynamoDBClient();
const sessionTableName = `session-${process.env.CommonStackName}`;

export async function querySession(sessionId: string) {
  return withRetry(async () => {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: sessionTableName,
        KeyConditionExpression: "sessionId = :value",
        ExpressionAttributeValues: {
          ":value": { S: sessionId },
        },
      })
    );

    if (result.Count === 0 || !result.Items) {
      throw new SessionNotFoundError(`Session with id ${sessionId} not found`);
    }

    return result.Items[0];
  });
}
export function isSessionExpired(sessionItem: SessionItem) {
  const now = Math.floor(Date.now() / 1000);
  return now > Number(sessionItem.expiryDate);
}
