import { DynamoDBClient, UpdateItemCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb";
import { SessionItem } from "../../src/database/types/session-item";
import { mockLogger } from "../logger";
import { updateRecordBySessionId } from "../../src/database/update-record-by-session-id";

const mockTableName = "some-stack-some-table";

const sessionId = "some-session";

jest.mock("@aws-sdk/client-dynamodb", () => ({
  UpdateItemCommand: jest.fn().mockImplementation((input) => ({
    type: "PutItemCommandClassInstance",
    input,
  })),
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

const dynamoClient = new DynamoDBClient();

function buildMockInsertRes(status: number) {
  return {
    Attributes: undefined,
    ConsumedCapacity: undefined,
    ItemCollectionMetrics: undefined,
    $metadata: {
      httpStatusCode: status,
    },
  };
}

const mockSuccessRes = buildMockInsertRes(201);

describe("updateRecordBySessionId()", () => {
  it("calls the Dynamo client correctly for a given record", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(mockSuccessRes);

    const result = await updateRecordBySessionId<SessionItem>(
      mockTableName,
      { sessionId, expiryDate: 999, accessToken: "yes-go-ahead", clientIpAddress: null, authorizationCode: undefined },
      mockLogger,
      dynamoClient
    );

    const mockUpdateItemInput: UpdateItemCommandInput = {
      TableName: mockTableName,
      Key: { sessionId: { S: sessionId } },
      UpdateExpression: `SET expiryDate=:expiryDate, accessToken=:accessToken REMOVE clientIpAddress`,
      ExpressionAttributeValues: {
        ":expiryDate": { N: "999" },
        ":accessToken": { S: "yes-go-ahead" },
      },
    };

    expect(result).toEqual(mockSuccessRes);
    expect(UpdateItemCommand).toHaveBeenCalledWith(mockUpdateItemInput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(new UpdateItemCommand(mockUpdateItemInput));
  });

  it("does nothing if given only the session id", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(mockSuccessRes);

    const result = await updateRecordBySessionId<SessionItem>(mockTableName, { sessionId }, mockLogger, dynamoClient);

    const mockUpdateItemInput: UpdateItemCommandInput = {
      TableName: mockTableName,
      Key: { sessionId: { S: sessionId } },
      UpdateExpression: ``,
      ExpressionAttributeValues: {},
    };

    expect(result).toEqual(mockSuccessRes);
    expect(UpdateItemCommand).toHaveBeenCalledWith(mockUpdateItemInput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(new UpdateItemCommand(mockUpdateItemInput));
  });

  it("works correctly if we are only updating", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(mockSuccessRes);

    const result = await updateRecordBySessionId<SessionItem>(
      mockTableName,
      { sessionId, clientIpAddress: "127.0.0.1" },
      mockLogger,
      dynamoClient
    );

    const mockUpdateItemInput: UpdateItemCommandInput = {
      TableName: mockTableName,
      Key: { sessionId: { S: sessionId } },
      UpdateExpression: `SET clientIpAddress=:clientIpAddress`,
      ExpressionAttributeValues: {
        ":clientIpAddress": {
          S: "127.0.0.1",
        },
      },
    };

    expect(result).toEqual(mockSuccessRes);
    expect(UpdateItemCommand).toHaveBeenCalledWith(mockUpdateItemInput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(new UpdateItemCommand(mockUpdateItemInput));
  });

  it("works correctly if we are only deleting", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(mockSuccessRes);

    const result = await updateRecordBySessionId<SessionItem>(
      mockTableName,
      { sessionId, authorizationCodeExpiryDate: null },
      mockLogger,
      dynamoClient
    );

    const mockUpdateItemInput: UpdateItemCommandInput = {
      TableName: mockTableName,
      Key: { sessionId: { S: sessionId } },
      UpdateExpression: `REMOVE authorizationCodeExpiryDate`,
      ExpressionAttributeValues: {},
    };

    expect(result).toEqual(mockSuccessRes);
    expect(UpdateItemCommand).toHaveBeenCalledWith(mockUpdateItemInput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(new UpdateItemCommand(mockUpdateItemInput));
  });
});
