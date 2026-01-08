import { mockLogger } from "../logger";
jest.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { DynamoDBClient, QueryCommand, QueryCommandOutput } from "@aws-sdk/client-dynamodb";
import { PersonIdentityItem } from "../../src/database/types/person-identity";
import { RecordNotFoundError, TooManyRecordsError } from "../../src/database/exceptions/errors";
import { SessionItem } from "../../src/database/types/session-item";
import { UnixSecondsTimestamp } from "../../src/types/brands";
import { getRecordBySessionId, getSessionBySessionId } from "../../src/database/get-record-by-session-id";
import { NinoUser } from "../../src/types/nino-user";
import { CriError } from "../../src/errors/cri-error";
import { metrics } from "../../src/util/metrics";

describe("getRecordBySessionId()", () => {
  const tableName = "some-table-some-stack";

  jest.mock("@aws-sdk/client-dynamodb", () => ({
    QueryCommand: jest.fn().mockImplementation((input) => ({
      type: "QueryCommandInstance",
      input,
    })),
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  }));

  const dynamoClient = new DynamoDBClient();

  const noMatchResponse: QueryCommandOutput = {
    Items: [],
    Count: 0,
    $metadata: {},
  };

  const now = Math.round(Date.now() / 1000);

  const anHourFromNow = (now + 60 * 60) as UnixSecondsTimestamp;

  const mockSessionEntity = {
    sessionId: { S: "12345678" },
    addresses: { L: [] },
    names: { L: [] },
    birthDates: { L: [] },
    expiryDate: { N: String(anHourFromNow) },
    socialSecurityRecord: { L: [] },
  };

  const validPersonIdentityResult: QueryCommandOutput = {
    Count: 1,
    Items: [mockSessionEntity],
    $metadata: {},
  };

  const validPersonIdentityOutput: PersonIdentityItem = {
    sessionId: "12345678",
    addresses: [],
    names: [],
    birthDates: [],
    expiryDate: anHourFromNow,
    socialSecurityRecord: [],
  };

  // @ts-expect-error - we need to override setTimeout to speed up execution of the tests
  global.setTimeout = jest.fn((callback) => callback());

  const dummyNow = 999999 as UnixSecondsTimestamp;

  Date.now = jest.fn().mockReturnValue(dummyNow * 1000);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns a valid personIdentityItem given a valid session ID", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(validPersonIdentityResult);

    const result = await getRecordBySessionId<PersonIdentityItem>(dynamoClient, tableName, "12345678", "expiryDate");

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(expect.any(QueryCommand));
    expect(dynamoClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: tableName,
          KeyConditionExpression: "sessionId = :value",
          FilterExpression: `#expiry > :expiry`,
          ExpressionAttributeNames: {
            "#expiry": "expiryDate",
          },
          ExpressionAttributeValues: {
            ":expiry": {
              N: String(dummyNow),
            },
            ":value": {
              S: "12345678",
            },
          },
        }),
      })
    );
  });

  it("handles ttl column as well as expiryDate", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue({
      Count: 1,
      Items: [
        {
          sessionId: { S: "12345678" },
          addresses: { L: [] },
          names: { L: [] },
          birthDates: { L: [] },
          ttl: { N: anHourFromNow.toString(10) },
          socialSecurityRecord: { L: [] },
        },
      ],
      $metadata: {},
    });

    const result = await getRecordBySessionId<NinoUser>(dynamoClient, tableName, "12345678", "ttl");

    expect(result).toEqual({
      sessionId: "12345678",
      addresses: [],
      names: [],
      birthDates: [],
      ttl: anHourFromNow,
      socialSecurityRecord: [],
    });
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("throws a TooManyRecordsError without retrying if multiple records are retrieved", async () => {
    const multiplePersonIdentityResult = {
      Count: 2,
      Items: [mockSessionEntity, mockSessionEntity],
      $metadata: {},
    };

    dynamoClient.send = jest.fn().mockResolvedValue(multiplePersonIdentityResult);

    await expect(
      getRecordBySessionId<PersonIdentityItem>(dynamoClient, tableName, "12345678", "expiryDate")
    ).rejects.toThrow(TooManyRecordsError);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("behaves correctly if result.Items is undefined", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue({ Count: 0 });

    await expect(
      getRecordBySessionId<PersonIdentityItem>(dynamoClient, tableName, "12345678", "expiryDate")
    ).rejects.toThrow(RecordNotFoundError);
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });

  it("retries up to three times to get a valid result from DynamoDB", async () => {
    const noMatchResponse: QueryCommandOutput = {
      Items: [],
      Count: 0,
      $metadata: {},
    };

    dynamoClient.send = jest
      .fn()
      .mockResolvedValueOnce(noMatchResponse)
      .mockResolvedValueOnce(noMatchResponse)
      .mockResolvedValueOnce(noMatchResponse)
      .mockResolvedValueOnce(validPersonIdentityResult);

    const result = await getRecordBySessionId<PersonIdentityItem>(dynamoClient, "12345678", tableName, "expiryDate");

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });

  it("returns as soon as it gets a valid result from DynamoDB", async () => {
    dynamoClient.send = jest
      .fn()
      .mockResolvedValueOnce(noMatchResponse)
      .mockResolvedValueOnce(validPersonIdentityResult);

    const result = await getRecordBySessionId<PersonIdentityItem>(dynamoClient, tableName, "12345678", "expiryDate");

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(2);
  });

  it("throws a RecordNotFoundError if DynamoDB returns no records, after three retries", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(noMatchResponse);

    await expect(
      getRecordBySessionId<PersonIdentityItem>(dynamoClient, tableName, "12345678", "expiryDate")
    ).rejects.toThrow(RecordNotFoundError);
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });

  it("returns a record from the session table", async () => {
    const expiry = Date.now() + 1000000;
    dynamoClient.send = jest.fn().mockResolvedValueOnce({
      Count: 1,
      Items: [
        {
          expiryDate: { N: expiry.toString() },
          sessionId: { S: "dummy" },
          clientId: { S: "dummy" },
          clientSessionId: { S: "dummy" },
          authorizationCodeExpiryDate: { N: "0" },
          redirectUri: { S: "dummy" },
          accessToken: { S: "dummy" },
          accessTokenExpiryDate: { S: "dummy" },
          clientIpAddress: { S: "dummy" },
          subject: { S: "dummy" },
        },
      ],
    });

    const result = await getRecordBySessionId<SessionItem>(dynamoClient, tableName, "dummy", "expiryDate");

    expect(result).toEqual({
      expiryDate: expiry,
      sessionId: "dummy",
      clientId: "dummy",
      clientSessionId: "dummy",
      authorizationCodeExpiryDate: 0,
      redirectUri: "dummy",
      accessToken: "dummy",
      accessTokenExpiryDate: "dummy",
      clientIpAddress: "dummy",
      subject: "dummy",
    });
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });
});

describe("getSessionBySessionId()", () => {
  jest.mock("../../src/util/metrics");

  const ddbMock = mockClient(DynamoDBClient);
  const now = Math.round(Date.now() / 1000);
  const anHourFromNow = now + 60 * 60;

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should successfully return a SessionItem", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          sessionId: { S: "session-123" },
          clientSessionId: { S: "gov-123" },
          expiryDate: { N: anHourFromNow.toString() },
        },
      ],
      Count: 1,
    });

    const sessionItem = await getSessionBySessionId("session-table", "session-123");
    expect(sessionItem.sessionId).toBe("session-123");
    expect(sessionItem.clientSessionId).toBe("gov-123");
    expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
      ExpressionAttributeValues: {
        ":expiry": { N: expect.stringMatching(/\d+/) },
        ":value": { S: "session-123" },
      },
      KeyConditionExpression: "sessionId = :value",
      FilterExpression: "#expiry > :expiry",
      ExpressionAttributeNames: {
        "#expiry": "expiryDate",
      },
      TableName: "session-table",
    });
  });

  it("should throw when Session not found", async () => {
    expect.assertions(3);

    ddbMock.on(QueryCommand).resolves({
      Items: [],
      Count: 0,
    });

    try {
      await getSessionBySessionId("session-table", "session-123");
    } catch (err) {
      expect(err).toBeInstanceOf(CriError);
      expect((err as CriError).message).toBe("Session not found");
      expect((err as CriError).status).toBe(400);
    }
  });

  it("should throw an exception and publish metric", async () => {
    const spy = jest.spyOn(metrics, "addMetric");
    ddbMock.on(QueryCommand).rejects();

    await expect(getSessionBySessionId("session-table", "session-123")).rejects.toThrow(Error);
    expect(spy).not.toHaveBeenCalled();
  });

  it("should throw an exception when it errors retrievings a record", async () => {
    ddbMock.on(QueryCommand).rejects();

    await expect(getSessionBySessionId("session-table", "session-123")).rejects.toThrow(Error);
  });
});
