import { DynamoDBClient, QueryCommand, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { AttemptItem, AttemptsResult } from "../types/attempt";

export async function getAttempts(
  attemptTable: string,
  dynamoClient: DynamoDBClient,
  sessionId: string,
  status?: "PASS" | "FAIL"
): Promise<AttemptsResult> {
  const statusQueryString = status ? [`attempt = :status`] : "";
  const statusAttribute: QueryCommandInput["ExpressionAttributeValues"] = status ? { ":status": { S: status } } : {};

  // Need to use ExpressionAttributeNames for ttl as it is a reserved word
  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html
  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ExpressionAttributeNames.html

  const command = new QueryCommand({
    TableName: attemptTable,
    KeyConditionExpression: "sessionId = :value",
    FilterExpression: ["#ttl > :ttl", ...statusQueryString].join(" and "),
    ExpressionAttributeNames: { "#ttl": "ttl" },
    ExpressionAttributeValues: {
      ":value": {
        S: sessionId,
      },
      ":ttl": {
        N: Math.floor(Date.now() / 1000).toString(),
      },
      ...statusAttribute,
    },
  });

  const result = await dynamoClient.send(command);
  const items: AttemptItem[] = (result.Items ?? []).map((item) => unmarshall(item) as AttemptItem);

  return {
    items,
    count: result.Count ?? 0,
  };
}
