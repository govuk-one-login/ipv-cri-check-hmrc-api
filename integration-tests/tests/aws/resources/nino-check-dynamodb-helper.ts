import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const populateNinoTable = async (testUser: Record<string, unknown>) => {
  const command = new PutCommand({
    TableName: process.env.NINO_USERS_TABLE as string,
    Item: testUser,
  });
  return await docClient.send(command);
};

export const clearItems = async (
  tableName: string,
  key: Record<string, unknown>
) => {
  const command = new DeleteCommand({
    TableName: tableName,
    Key: key,
  });
  return await docClient.send(command);
};
