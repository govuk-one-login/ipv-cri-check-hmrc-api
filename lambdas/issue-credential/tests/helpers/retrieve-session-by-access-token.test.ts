import { logger } from "../../../common/src/util/logger";
import { retrieveSessionByAccessToken } from "../../src/helpers/retrieve-session-by-access-token";
import { mockDynamoClient } from "../../../common/tests/mocks/mockDynamoClient";
import { mockSession, mockAccessToken } from "../../../common/tests/mocks/mockData";
import { marshall } from "@aws-sdk/util-dynamodb";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
jest.mock("../../../common/src/util/logger");
jest.mock("../../../common/src/util/metrics");

jest.mock("@aws-sdk/client-dynamodb", () => ({
  QueryCommand: jest.fn().mockImplementation((input) => ({
    type: "QueryCommandInstance",
    input,
  })),
  DynamoDBClient: jest.fn().mockImplementation(() => mockDynamoClient),
}));

const mockSendFunction = mockDynamoClient.send as jest.Mock;
mockSendFunction.mockResolvedValue({
  Items: [marshall(mockSession)],
  Count: 1,
});

const sessionTableName = "my-session-zone";

describe("retrieveSessionByAccessToken()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns as expected for some valid input", async () => {
    const result = await retrieveSessionByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);

    expect(mockDynamoClient.send).toHaveBeenCalledWith(
      new QueryCommand({
        TableName: sessionTableName,
        KeyConditionExpression: "accessToken = :value",
        FilterExpression: "expiryDate > :expiry",
        ExpressionAttributeValues: {
          ":value": {
            S: mockAccessToken,
          },
          ":expiry": {
            N: Math.floor(Date.now() / 1000).toString(),
          },
        },
      })
    );

    expect(result).toEqual(mockSession);
  });

  it("handles a missing record correctly", async () => {
    mockSendFunction.mockResolvedValueOnce({
      Items: [],
      Count: 0,
    });

    let thrown = false;

    try {
      await retrieveSessionByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 400 }));
    }

    expect(thrown).toEqual(true);
  });

  it("handles too many records correctly", async () => {
    mockSendFunction.mockResolvedValueOnce({
      Items: [marshall(mockSession), marshall(mockSession)],
      Count: 2,
    });

    let thrown = false;

    try {
      await retrieveSessionByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(
        expect.objectContaining({ name: "CriError", status: 500, message: expect.stringContaining("2") })
      );
    }

    expect(thrown).toEqual(true);
  });

  it("handles an unrecognised error correctly", async () => {
    mockSendFunction.mockImplementationOnce(() => {
      throw new Error("illegal");
    });

    let thrown = false;

    try {
      await retrieveSessionByAccessToken(sessionTableName, mockDynamoClient, mockAccessToken);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });
});
