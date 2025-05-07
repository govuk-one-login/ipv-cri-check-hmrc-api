import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SessionItem } from "./session-item";

const dynamoClient = new DynamoDBClient({});
const sessionTableName = `session-${process.env.CommonStackName}`;

export async function querySession(sessionId: string) {
  return await dynamoClient.send(
    new QueryCommand({
      TableName: sessionTableName,
      KeyConditionExpression: "sessionId = :value",
      ExpressionAttributeValues: {
        ":value": {
          S: sessionId,
        },
      },
    })
  );
}

export function isSessionExpired(sessionItem: SessionItem) {
  const now = Math.floor(Date.now() / 1000);
  return now > Number(sessionItem.expiryDate);
}
