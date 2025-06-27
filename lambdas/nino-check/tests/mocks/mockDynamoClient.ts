import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

export const mockDynamoClient = new DynamoDBClient();
