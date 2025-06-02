import { DynamoDBClient, QueryCommandOutput } from "@aws-sdk/client-dynamodb";
import { PersonIdentityItem } from "../src/types/person-identity";
import { getPersonIdentity } from "../src/person-identity-service";
import {
  RecordExpiredError,
  RecordNotFoundError,
} from "../src/exceptions/errors";

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
    .map((_, index) => time + index * expiryInterval * 60);

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

// an hour from now
const validExpiryTime = now + 60 * 60;
const [validPersonIdentityResult, validPersonIdentityOutput] =
  personIdentityObjectPairWithExpiry(validExpiryTime);

// an hour ago
const invalidExpiryTime = now - 60 * 60;

// @ts-expect-error - we need to override setTimeout to speed up execution of the tests
global.setTimeout = jest.fn((callback) => callback());

describe("getPersonIdentity", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns a valid personIdentityItem given a valid session ID", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(validPersonIdentityResult);

    const result = await getPersonIdentity("12345678", dynamoClient);

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("returns multiple records if that is what DynamoDB returns", async () => {
    const [validMultipleRecordsResult, validMultipleRecordsOutput] =
      personIdentityObjectPairWithExpiry(validExpiryTime, 3);

    dynamoClient.send = jest.fn().mockResolvedValue(validMultipleRecordsResult);

    const result = await getPersonIdentity("12345678", dynamoClient);

    expect(result).toEqual(validMultipleRecordsOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("filters out expired records if DynamoDB returns a mixture", async () => {
    // Generate 4 items, spaced 25 minutes apart, starting an hour ago.
    // This should give us three invalid items (-60, -35, -10) and one valid one (+15)
    const [mixedMultipleRecordsResult, mixedMultipleRecordsOutput] =
      personIdentityObjectPairWithExpiry(invalidExpiryTime, 4, 25);

    dynamoClient.send = jest.fn().mockResolvedValue(mixedMultipleRecordsResult);

    const singleValidResult = mixedMultipleRecordsOutput.filter(
      (v) => v.expiryDate > Date.now() / 1000
    );
    expect(singleValidResult).toHaveLength(1);

    const result = await getPersonIdentity("12345678", dynamoClient);

    expect(result).toEqual(singleValidResult);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("throws a RecordExpiredError without retrying if the session has expired", async () => {
    const [expiredPersonIdentityResult] =
      personIdentityObjectPairWithExpiry(invalidExpiryTime);

    dynamoClient.send = jest
      .fn()
      .mockResolvedValue(expiredPersonIdentityResult);

    await expect(getPersonIdentity("12345678", dynamoClient)).rejects.toThrow(
      RecordExpiredError
    );
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("throws a RecordExpiredError without retrying if multiple expired sessions are retrieved", async () => {
    // generate 5 expired sessions
    const [multipleExpiredPersonIdentityResult] =
      personIdentityObjectPairWithExpiry(invalidExpiryTime, 5);

    dynamoClient.send = jest
      .fn()
      .mockResolvedValue(multipleExpiredPersonIdentityResult);

    await expect(getPersonIdentity("12345678", dynamoClient)).rejects.toThrow(
      RecordExpiredError
    );
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

    const result = await getPersonIdentity("12345678", dynamoClient);

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });

  it("returns as soon as it gets a valid result from DynamoDB", async () => {
    dynamoClient.send = jest
      .fn()
      .mockResolvedValueOnce(noMatchResponse)
      .mockResolvedValueOnce(validPersonIdentityResult);

    const result = await getPersonIdentity("12345678", dynamoClient);

    expect(result).toEqual(validPersonIdentityOutput);
    expect(dynamoClient.send).toHaveBeenCalledTimes(2);
  });

  it("throws a RecordNotFoundError if DynamoDB returns no records, after three retries", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(noMatchResponse);

    await expect(getPersonIdentity("12345678", dynamoClient)).rejects.toThrow(
      RecordNotFoundError
    );
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });
});
