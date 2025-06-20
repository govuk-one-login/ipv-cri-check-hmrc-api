import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from "@aws-sdk/client-dynamodb";
import { insertRecord } from "../../src/database/insert-record";
import { SessionItem } from "../../src/database/types/session-item";
import { mockLogger } from "../logger";
import { marshall } from "@aws-sdk/util-dynamodb";

const mockTableName = "some-stack-some-table";

const mockSessionItem: SessionItem = {
  expiryDate: 999,
  sessionId: "some-session",
  clientId: "aaa-aaa-aaa-aaa",
  clientSessionId: "blahblah-blahblah",
  authorizationCodeExpiryDate: 987,
  redirectUri: "example.com/redirect",
  accessToken: "yes-go-ahead",
  accessTokenExpiryDate: 456,
  clientIpAddress: "127.0.0.1",
  subject: "bob",
};

jest.mock("@aws-sdk/client-dynamodb", () => ({
  PutItemCommand: jest.fn().mockImplementation((input) => ({
    type: "PutItemCommandClassInstance",
    input,
  })),
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

const mockPutItemInput: PutItemCommandInput = {
  TableName: mockTableName,
  Item: marshall(mockSessionItem),
};

const mockPutItemCommand = new PutItemCommand(mockPutItemInput);

const dynamoClient = new DynamoDBClient();

function buildMockInsertRes(status: number) {
  return {
    Attributes: undefined,
    ConsumedCapacity: undefined,
    ItemCollectionMetrics: undefined,
    $metadata: {
      httoStatusCode: status,
    },
  };
}

const mockSuccessRes = buildMockInsertRes(201);

describe("insertRecord()", () => {
  it("calls the Dynamo client correctly for a given record", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(mockSuccessRes);

    const result = await insertRecord<SessionItem>(mockTableName, mockSessionItem, mockLogger, dynamoClient);

    expect(result).toEqual(mockSuccessRes);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(mockPutItemCommand);
    expect(PutItemCommand).toHaveBeenCalledWith(mockPutItemInput);
  });
});
