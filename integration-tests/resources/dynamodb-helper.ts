import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { createSendCommand } from "./aws-helper";

type Keys = Record<string, unknown>;
type TableRecords = { tableName: string; items: Keys };

const sendCommand = createSendCommand(() =>
  DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION })
  )
);

export const getItemByKey = (tableName: string, key: Keys) =>
  sendCommand(GetCommand, { TableName: tableName, Key: key });

export const populateTable = (tableName: string, items: Keys) =>
  sendCommand(PutCommand, { TableName: tableName, Item: items });

export const populateTables = (...tableRecords: TableRecords[]) =>
  Promise.all(
    tableRecords.map((record) => populateTable(record.tableName, record.items))
  );

export const clearItems = (tableName: string, items: Keys) =>
  sendCommand(DeleteCommand, { TableName: tableName, Key: items });

export async function clearAttemptsTable(
  sessionId: string,
  tableName?: string
) {
  if (tableName) {
    const query = await sendCommand(QueryCommand, {
      TableName: tableName,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
      },
    });
    if (query.Items) {
      query.Items.forEach((item) => {
        clearItems(tableName, {
          sessionId: item.sessionId,
          timestamp: item.timestamp,
        });
      });
    }
  }
}

export const clearItemsFromTables = (...tableRecords: TableRecords[]) =>
  Promise.all(
    tableRecords.map((record) => clearItems(record.tableName, record.items))
  );
