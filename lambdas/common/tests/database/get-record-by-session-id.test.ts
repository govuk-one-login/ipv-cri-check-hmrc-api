import { DynamoDBClient, QueryCommand, QueryCommandOutput } from "@aws-sdk/client-dynamodb";
import { PersonIdentityItem } from "../../src/database/types/person-identity";
import { getRecordBySessionId } from "../../src/database/get-record-by-session-id";
import { RecordExpiredError, RecordNotFoundError, TooManyRecordsError } from "../../src/database/exceptions/errors";
import { mockLogger } from "../logger";
import { SessionItem } from "../../src/database/types/session-item";
import { UnixSecondsTimestamp } from "../../src/types/brands";

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

/**
 * Given an expiry time, returns a DynamoDB response and an unmarshalled record with that expiry.
 * Used immediately below to generate valid / expired test data.
 */
function personIdentityObjectPairWithExpiry(
  time: number,
  /**
   * Number of items to generate.
   *
   * If greater than 1, records will be generated with expiries every minute after the start time,
   * unless a different expiry is set.
   */
  count: number = 1,
  /**
   * Gap between expiries, in minutes.
   */
  expiryInterval: number = 1
): [QueryCommandOutput, PersonIdentityItem[]] {
  const expiries = new Array(count)
    .fill(0)
    .map((_, index) => (time + index * expiryInterval * 60) as UnixSecondsTimestamp);

  return [
    {
      Count: count,
      Items: expiries.map((e) => ({
        sessionId: { S: "12345678" },
        addresses: { L: [] },
        names: { L: [] },
        birthDates: { L: [] },
        expiryDate: { N: e.toString(10) },
        socialSecurityRecord: { L: [] },
      })),
      $metadata: {},
    },
    expiries.map((e) => ({
      sessionId: "12345678",
      addresses: [],
      names: [],
      birthDates: [],
      expiryDate: e,
      socialSecurityRecord: [],
    })),
  ];
}

const noMatchResponse: QueryCommandOutput = {
  Items: [],
  Count: 0,
  $metadata: {},
};

const now = Math.round(Date.now() / 1000);

const anHourFromNow = now + 60 * 60;
const [validPersonIdentityResult, validPersonIdentityOutput] = personIdentityObjectPairWithExpiry(anHourFromNow);

const anHourAgo = now - 60 * 60;

// @ts-expect-error - we need to override setTimeout to speed up execution of the tests
global.setTimeout = jest.fn((callback) => callback());

describe("getRecordBySessionId()", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns a valid personIdentityItem given a valid session ID", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(validPersonIdentityResult);

    const result = await getRecordBySessionId<PersonIdentityItem>(
      tableName,
      "12345678",
      mockLogger,
      undefined,
      dynamoClient
    );

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
    expect(dynamoClient.send).toHaveBeenCalledWith(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "sessionId = :value",
        ExpressionAttributeValues: {
          ":value": {
            S: "12345678",
          },
        },
      })
    );
  });

  it("returns multiple records if allowMultipleEntries=true", async () => {
    const [validMultipleRecordsResult, validMultipleRecordsOutput] = personIdentityObjectPairWithExpiry(
      anHourFromNow,
      3
    );

    dynamoClient.send = jest.fn().mockResolvedValue(validMultipleRecordsResult);

    const result = await getRecordBySessionId<PersonIdentityItem>(
      tableName,
      "12345678",
      mockLogger,
      { allowMultipleEntries: true },
      dynamoClient
    );

    expect(result).toEqual(validMultipleRecordsOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("returns no records if allowNoEntries=true", async () => {
    const [validMultipleRecordsResult, validMultipleRecordsOutput] = personIdentityObjectPairWithExpiry(
      anHourFromNow,
      0
    );

    dynamoClient.send = jest.fn().mockResolvedValue(validMultipleRecordsResult);

    const result = await getRecordBySessionId<PersonIdentityItem>(
      tableName,
      "12345678",
      mockLogger,
      { allowNoEntries: true },
      dynamoClient
    );

    expect(result).toEqual(validMultipleRecordsOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
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

    const result = await getRecordBySessionId<PersonIdentityItem>(tableName, "12345678", mockLogger, {}, dynamoClient);

    expect(result).toEqual([
      {
        sessionId: "12345678",
        addresses: [],
        names: [],
        birthDates: [],
        ttl: anHourFromNow,
        socialSecurityRecord: [],
      },
    ]);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("filters out expired records if DynamoDB returns a mixture", async () => {
    // Generate 4 items, spaced 25 minutes apart, starting an hour ago.
    // This should give us three invalid items (-60, -35, -10) and one valid one (+15)
    const [mixedMultipleRecordsResult, mixedMultipleRecordsOutput] = personIdentityObjectPairWithExpiry(
      anHourAgo,
      4,
      25
    );

    dynamoClient.send = jest.fn().mockResolvedValue(mixedMultipleRecordsResult);

    const singleValidResult = mixedMultipleRecordsOutput.filter((v) => v.expiryDate > Date.now() / 1000);
    expect(singleValidResult).toHaveLength(1);

    const result = await getRecordBySessionId<PersonIdentityItem>(tableName, "12345678", mockLogger, {}, dynamoClient);

    expect(result).toEqual(singleValidResult);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("throws a RecordExpiredError without retrying if the record has expired", async () => {
    const [expiredPersonIdentityResult] = personIdentityObjectPairWithExpiry(anHourAgo);

    dynamoClient.send = jest.fn().mockResolvedValue(expiredPersonIdentityResult);

    await expect(
      getRecordBySessionId<PersonIdentityItem>(tableName, "12345678", mockLogger, undefined, dynamoClient)
    ).rejects.toThrow(RecordExpiredError);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("fails a bad ttl column in the same way as a bad expiryDate", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue({
      Count: 1,
      Items: [
        {
          sessionId: { S: "12345678" },
          addresses: { L: [] },
          names: { L: [] },
          birthDates: { L: [] },
          ttl: { N: anHourAgo.toString(10) },
          socialSecurityRecord: { L: [] },
        },
      ],
      $metadata: {},
    });

    await expect(
      getRecordBySessionId<PersonIdentityItem>(tableName, "12345678", mockLogger, undefined, dynamoClient)
    ).rejects.toThrow(RecordExpiredError);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("throws a RecordExpiredError without retrying if multiple expired records are retrieved", async () => {
    // generate 5 expired sessions
    const [multipleExpiredPersonIdentityResult] = personIdentityObjectPairWithExpiry(anHourAgo, 5);

    dynamoClient.send = jest.fn().mockResolvedValue(multipleExpiredPersonIdentityResult);

    await expect(
      getRecordBySessionId<PersonIdentityItem>(tableName, "12345678", mockLogger, undefined, dynamoClient)
    ).rejects.toThrow(RecordExpiredError);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("throws a TooManyRecordsError without retrying if multiple records are retrieved", async () => {
    const [multiplePersonIdentityResult] = personIdentityObjectPairWithExpiry(anHourFromNow, 2);

    dynamoClient.send = jest.fn().mockResolvedValue(multiplePersonIdentityResult);

    await expect(
      getRecordBySessionId<PersonIdentityItem>(tableName, "12345678", mockLogger, undefined, dynamoClient)
    ).rejects.toThrow(TooManyRecordsError);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("doesn't break if result.Items is undefined", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue({ Count: 0 });

    const result = await getRecordBySessionId<PersonIdentityItem>(
      tableName,
      "12345678",
      mockLogger,
      { allowNoEntries: true },
      dynamoClient
    );

    expect(result).toEqual([]);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
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

    const result = await getRecordBySessionId<PersonIdentityItem>("12345678", tableName, mockLogger, {}, dynamoClient);

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });

  it("returns as soon as it gets a valid result from DynamoDB", async () => {
    dynamoClient.send = jest
      .fn()
      .mockResolvedValueOnce(noMatchResponse)
      .mockResolvedValueOnce(validPersonIdentityResult);

    const result = await getRecordBySessionId<PersonIdentityItem>(
      tableName,
      "12345678",
      mockLogger,
      undefined,
      dynamoClient
    );

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(2);
  });

  it("throws a RecordNotFoundError if DynamoDB returns no records, after three retries", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(noMatchResponse);

    await expect(
      getRecordBySessionId<PersonIdentityItem>(tableName, "12345678", mockLogger, undefined, dynamoClient)
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

    const result = await getRecordBySessionId<SessionItem>(tableName, "dummy", mockLogger, undefined, dynamoClient);

    expect(result).toEqual([
      {
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
      },
    ]);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("should throw if session has expired", async () => {
    dynamoClient.send = jest.fn().mockResolvedValueOnce({
      Count: 1,
      Items: [
        {
          expiryDate: { N: "123" },
          sessionId: { S: "dummy" },
        },
      ],
    });

    const result = getRecordBySessionId<SessionItem>(tableName, "dummy", mockLogger, {}, dynamoClient);

    await expect(result).rejects.toThrow(RecordExpiredError);

    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });
});
