import { Logger } from "@aws-lambda-powertools/logger";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

// TODO NB: This function needs review - retry logic, error handling etc are missing.
export async function updateRecordBySessionId<T extends { sessionId: string }>(
  tableName: string,
  record: Partial<T> & { sessionId: string },
  logger: Logger,
  dynamoClient: DynamoDBClient = new DynamoDBClient()
): Promise<PutItemCommandOutput> {
  const { sessionId, ...properties } = record;

  const txnCmd = new PutItemCommand({
    TableName: tableName,
    ConditionExpression: "sessionId = :value",
    ExpressionAttributeValues: {
      ":value": {
        S: sessionId,
      },
    },
    Item: marshall(properties),
  });

  const txnRes = await dynamoClient.send(txnCmd);

  return txnRes;
}
