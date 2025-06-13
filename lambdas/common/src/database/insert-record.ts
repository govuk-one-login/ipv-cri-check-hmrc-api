import { Logger } from "@aws-lambda-powertools/logger";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

// TODO NB: This function needs review - retry logic, error handling etc are missing.
export async function insertRecord<T>(
  tableName: string,
  record: T,
  logger: Logger,
  dynamoClient: DynamoDBClient = new DynamoDBClient()
): Promise<PutItemCommandOutput> {
  const saveCmd = new PutItemCommand({
    TableName: tableName,
    Item: marshall(record),
  });

  const saveRes = await dynamoClient.send(saveCmd);

  return saveRes;
}
