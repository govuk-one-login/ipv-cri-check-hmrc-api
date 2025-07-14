import { countAttempts } from "../../src/database/count-attempts";
import { mockSessionId } from "../../../common/tests/mocks/mockData";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { UnixSecondsTimestamp } from "../../src/types/brands";
import { mockDynamoClient } from "../mocks/mockDynamoClient";

jest.mock("@aws-sdk/client-dynamodb", () => ({
  QueryCommand: jest.fn().mockImplementation((input) => ({
    type: "QueryCommandInstance",
    input,
  })),
  DynamoDBClient: jest.fn().mockImplementation(() => mockDynamoClient),
}));

const mockSendFunction = mockDynamoClient.send as unknown as jest.Mock;

const attemptTableName = "attempt-club";

const mockTtl = 999999 as UnixSecondsTimestamp;

Date.now = jest.fn().mockReturnValue(mockTtl * 1000);

const queryCommand = new QueryCommand({
  TableName: attemptTableName,
  Select: "COUNT",
  KeyConditionExpression: "sessionId = :value",
  FilterExpression: "#ttl > :ttl",
  ExpressionAttributeNames: {
    "#ttl": "ttl",
  },
  ExpressionAttributeValues: {
    ":value": {
      S: mockSessionId,
    },
    ":ttl": {
      N: mockTtl.toString(),
    },
  },
});

describe("countAttempts()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the attempt count correctly", async () => {
    mockSendFunction.mockResolvedValue({ Count: 0 });

    const count0 = await countAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(count0).toBe(0);

    mockSendFunction.mockReset();

    mockSendFunction.mockResolvedValue({ Count: 1 });

    const count1 = await countAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(count1).toBe(1);

    mockSendFunction.mockReset();

    mockSendFunction.mockResolvedValue({ Count: 2 });

    const count2 = await countAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(count2).toBe(2);
  });

  it("returns 0 if result.Count is unset", async () => {
    mockSendFunction.mockResolvedValue({});

    const count = await countAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(count).toBe(0);
  });

  it("returns correctly when PASS / FAIL statuses are passed down", async () => {
    mockSendFunction.mockResolvedValue({ Count: 1 });

    const count1 = await countAttempts(attemptTableName, mockDynamoClient, mockSessionId, "PASS");

    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      new QueryCommand({
        TableName: attemptTableName,
        Select: "COUNT",
        KeyConditionExpression: "sessionId = :value",
        FilterExpression: "#ttl > :ttl and attempt = :status",
        ExpressionAttributeNames: {
          "#ttl": "ttl",
        },
        ExpressionAttributeValues: {
          ":value": {
            S: mockSessionId,
          },
          ":ttl": {
            N: mockTtl.toString(),
          },
          ":status": {
            S: "PASS",
          },
        },
      })
    );
    expect(count1).toBe(1);

    mockSendFunction.mockClear();
    mockSendFunction.mockResolvedValue({ Count: 5 });

    const count5 = await countAttempts(attemptTableName, mockDynamoClient, mockSessionId, "FAIL");

    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      new QueryCommand({
        TableName: attemptTableName,
        Select: "COUNT",
        KeyConditionExpression: "sessionId = :value",
        FilterExpression: "#ttl > :ttl and attempt = :status",
        ExpressionAttributeNames: {
          "#ttl": "ttl",
        },
        ExpressionAttributeValues: {
          ":value": {
            S: mockSessionId,
          },
          ":ttl": {
            N: mockTtl.toString(),
          },
          ":status": {
            S: "FAIL",
          },
        },
      })
    );
    expect(count5).toBe(5);
  });
});
