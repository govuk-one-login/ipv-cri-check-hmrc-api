import { getAttempts } from "../../src/database/get-attempts";
import { mockSessionId } from "../mocks/mockData";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { UnixSecondsTimestamp } from "@govuk-one-login/cri-types";
import { mockDynamoClient, mockSend } from "../mocks/mockDynamoClient";

vi.mock("@aws-sdk/client-dynamodb", () => ({
  QueryCommand: vi.fn().mockImplementation(function (input) {
    return { type: "QueryCommandInstance", input };
  }),
  DynamoDBClient: vi.fn().mockImplementation(function () {
    return mockDynamoClient;
  }),
}));

const mockSendFunction = mockSend;

const attemptTableName = "attempt-club";

const mockTtl = 999999 as UnixSecondsTimestamp;

Date.now = vi.fn().mockReturnValue(mockTtl * 1000);

const queryCommand = new QueryCommand({
  TableName: attemptTableName,
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

describe("getAttempts()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the attempt count and items correctly", async () => {
    mockSendFunction.mockResolvedValueOnce({ Count: 0, Items: [] });

    const result0 = await getAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(result0.count).toBe(0);
    expect(result0.items).toEqual([]);

    mockSendFunction.mockResolvedValueOnce({
      Count: 1,
      Items: [{ sessionId: { S: mockSessionId }, attempt: { S: "PASS" } }],
    });

    const result1 = await getAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(result1.count).toBe(1);
    expect(result1.items).toHaveLength(1);

    mockSendFunction.mockResolvedValueOnce({
      Count: 2,
      Items: [
        { sessionId: { S: mockSessionId }, attempt: { S: "PASS" } },
        { sessionId: { S: mockSessionId }, attempt: { S: "PASS" } },
      ],
    });

    const result2 = await getAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(result2.count).toBe(2);
    expect(result2.items).toHaveLength(2);
  });

  it("returns 0 and empty array if result.Count is unset", async () => {
    mockSendFunction.mockResolvedValueOnce({});

    const result = await getAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(queryCommand);
    expect(result.count).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("returns correctly when PASS / FAIL statuses are passed down", async () => {
    mockSendFunction.mockResolvedValueOnce({ Count: 1, Items: [] });

    const result1 = await getAttempts(attemptTableName, mockDynamoClient, mockSessionId, "PASS");

    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      new QueryCommand({
        TableName: attemptTableName,
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
    expect(result1.count).toBe(1);

    mockSendFunction.mockResolvedValueOnce({ Count: 5, Items: [] });

    const result5 = await getAttempts(attemptTableName, mockDynamoClient, mockSessionId, "FAIL");

    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      new QueryCommand({
        TableName: attemptTableName,
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
    expect(result5.count).toBe(5);
  });
});
