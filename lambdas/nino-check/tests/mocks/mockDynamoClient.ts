import { DynamoDBClient, PutItemCommandInput, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb";

export const mockPutItemCommand = (input: PutItemCommandInput) => ({
  type: "PutItemCommandClassInstance",
  input,
});

export const mockUpdateItemCommand = (input: UpdateItemCommandInput) => ({
  type: "UpdateItemCommandClassInstance",
  input,
});

export const mockDynamoClientClass = () => ({
  send: jest.fn(),
});

jest.mock("@aws-sdk/client-dynamodb", () => ({
  PutItemCommand: jest.fn().mockImplementation(mockPutItemCommand),
  UpdateItemCommand: jest.fn().mockImplementation(mockUpdateItemCommand),
  DynamoDBClient: jest.fn().mockImplementation(mockDynamoClientClass),
}));

export const mockDynamoClient = new DynamoDBClient();

export const mockSaveRes = {
  Attributes: {},
  ConsumedCapacity: {},
  ItemCollectionMetrics: {},
  $metadata: {
    httpStatusCode: 201,
  },
};
