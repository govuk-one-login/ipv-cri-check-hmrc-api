import { logger } from "../../../common/src/util/logger";
import { retrieveSessionIdByAccessToken } from "../../src/helpers/retrieve-session-by-access-token";
import { MockCommand, MockDynamoClient } from "../../../common/tests/mocks/mockDynamoClient";
import { mockAccessToken, mockSessionFromIndex } from "../../../common/tests/mocks/mockData";
import { marshall } from "@aws-sdk/util-dynamodb";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

vi.mock("../../../common/src/util/logger");
vi.mock("../../../common/src/util/metrics");

vi.doMock("@aws-sdk/client-dynamodb", () => ({
  QueryCommand: MockCommand,
  DynamoDBClient: MockDynamoClient,
}));

import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const mockDynamoClient = new DynamoDBClient();

const mockSendFunction = mockDynamoClient.send as Mock;

const sessionTableName = "my-session-zone";

describe("retrieveSessionByAccessToken()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns as expected for some valid input", async () => {
    mockSendFunction.mockResolvedValueOnce({
      Items: [marshall(mockSessionFromIndex)],
      Count: 1,
    });

    const result = await retrieveSessionIdByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TableName: sessionTableName,
          IndexName: "access-token-index",
          KeyConditionExpression: "accessToken = :value",
          ExpressionAttributeValues: {
            ":value": {
              S: mockAccessToken,
            },
          },
        },
      })
    );

    expect(result).toEqual(mockSessionFromIndex.sessionId);
  });

  it("handles a missing record correctly", async () => {
    mockSendFunction.mockResolvedValue({
      Items: [],
      Count: 0,
    });

    let thrown = false;

    try {
      await retrieveSessionIdByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 400 }));
    }

    expect(thrown).toEqual(true);
  });

  it("handles too many records correctly", async () => {
    mockSendFunction.mockResolvedValue({
      Items: [marshall(mockSessionFromIndex), marshall(mockSessionFromIndex)],
      Count: 2,
    });

    let thrown = false;

    try {
      await retrieveSessionIdByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(
        expect.objectContaining({ name: "CriError", status: 500, message: expect.stringContaining("2") })
      );
    }

    expect(thrown).toEqual(true);
  });

  it("handles an unrecognised error correctly", async () => {
    mockSendFunction.mockImplementation(() => {
      throw new Error("illegal");
    });

    let thrown = false;

    try {
      await retrieveSessionIdByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });

  it("should retry if a query fails", async () => {
    mockSendFunction.mockResolvedValueOnce({
      Items: [],
      Count: 0,
    });
    mockSendFunction.mockResolvedValueOnce({
      Items: [marshall(mockSessionFromIndex)],
      Count: 1,
    });

    const result = await retrieveSessionIdByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);

    expect(result).toEqual(mockSessionFromIndex.sessionId);
    expect(mockSendFunction).toHaveBeenCalledTimes(2);
  });
});
