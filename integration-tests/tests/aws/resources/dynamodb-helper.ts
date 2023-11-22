import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { createSendCommand } from "./aws-helper";

type Keys = Record<string, unknown>;
type TableRecords = { tableName: string; items: Keys };

const sendCommand = createSendCommand(() =>
  DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION })
  )
);

export const populateTable = (tableName: string, items: Keys) =>
  sendCommand(PutCommand, { TableName: tableName, Item: items });

export const populateTables = (...tableRecords: TableRecords[]) =>
  Promise.all(
    tableRecords.map((record) => populateTable(record.tableName, record.items))
  );

export const clearItems = (tableName: string, items: Keys) =>
  sendCommand(DeleteCommand, { TableName: tableName, Key: items });

export const clearItemsFromTables = (...tableRecords: TableRecords[]) =>
  Promise.all(
    tableRecords.map((record) => clearItems(record.tableName, record.items))
  );
