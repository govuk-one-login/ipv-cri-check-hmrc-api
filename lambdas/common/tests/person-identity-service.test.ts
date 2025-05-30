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
  time: number
): [QueryCommandOutput, PersonIdentityItem] {
  return [
    {
      Count: 1,
      Items: [
        {
          sessionId: { S: "12345678" },
          addresses: { L: [] },
          names: { L: [] },
          birthDates: { L: [] },
          expiryDate: { N: time.toString(10) },
          socialSecurityRecord: { L: [] },
        },
      ],
      $metadata: {},
    },
    {
      sessionId: "12345678",
      addresses: [],
      names: [],
      birthDates: [],
      expiryDate: time,
      socialSecurityRecord: [],
    },
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
const [validPersonIdentityResult, validPersonIdentityItem] =
  personIdentityObjectPairWithExpiry(validExpiryTime);

// an hour ago
const invalidExpiryTime = now - 60 * 60;
const [expiredPersonIdentityResult] =
  personIdentityObjectPairWithExpiry(invalidExpiryTime);

describe("getPersonIdentity", () => {
  it("returns a valid personIdentityItem given a valid session ID", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(validPersonIdentityResult);

    const result = await getPersonIdentity("12345678", dynamoClient);

    expect(result).toEqual(validPersonIdentityItem);
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });

  it("throws a RecordExpiredError without retrying if the session has expired", async () => {
    dynamoClient.send = jest
      .fn()
      .mockResolvedValue(expiredPersonIdentityResult);

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

    expect(result).toEqual(validPersonIdentityItem);
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });

  it("returns as soon as it gets a valid result from DynamoDB", async () => {
    dynamoClient.send = jest
      .fn()
      .mockResolvedValueOnce(noMatchResponse)
      .mockResolvedValueOnce(validPersonIdentityResult);

    const result = await getPersonIdentity("12345678", dynamoClient);

    expect(result).toEqual(validPersonIdentityItem);
    expect(dynamoClient.send).toHaveBeenCalledTimes(2);
  });

  it("throws a RecordNotFoundError after retrying three times", async () => {
    dynamoClient.send = jest.fn().mockResolvedValue(noMatchResponse);

    await expect(getPersonIdentity("12345678", dynamoClient)).rejects.toThrow(
      RecordNotFoundError
    );
    expect(dynamoClient.send).toHaveBeenCalledTimes(4);
  });
});
