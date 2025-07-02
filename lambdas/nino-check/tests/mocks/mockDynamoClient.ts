import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const mockDynamoClient = {
  send: jest.fn(),
} as unknown as DynamoDBClient;

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => mockDynamoClient),
}));
