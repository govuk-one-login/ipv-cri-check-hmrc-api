import {
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { SessionItem } from "../../src/database/types/session-item";
import { mockLogger } from "../logger";
import { marshall } from "@aws-sdk/util-dynamodb";
import { updateRecordBySessionId } from "../../src/database/update-record-by-session-id";

const mockTableName = "some-stack-some-table";

const sessionId = "some-session";

const mockSessionData: Omit<SessionItem, "sessionId"> = {
  expiryDate: 999,
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
  ConditionExpression: "sessionId = :value",
  ExpressionAttributeValues: {
    ":value": {
      S: sessionId,
    },
  },
  Item: marshall(mockSessionData),
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

describe("updateRecordBySessionId()", () => {
  it("calls the Dynamo client correctly for a given record", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(mockSuccessRes);

    const result = await updateRecordBySessionId<SessionItem>(
      mockTableName,
      { sessionId, ...mockSessionData },
      mockLogger,
      dynamoClient
    );

    expect(result).toEqual(mockSuccessRes);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(mockPutItemCommand);
    expect(PutItemCommand).toHaveBeenCalledWith(mockPutItemInput);
  });
});
