import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withRetry } from "../util/retry";
import { isRecordExpired, RecordWithExpiry } from "./util/is-record-expired";
import { RecordExpiredError, RecordNotFoundError, TooManyRecordsError } from "./exceptions/errors";
import { Logger } from "@aws-lambda-powertools/logger";

export type SessionIdRecord = { sessionId: string } & RecordWithExpiry;

/**
 * Retrieves a record from DynamoDB, given a table name and session ID.
 * Handles retries and expiry validation, and returns an array of valid entries.
 * The array will usually have length 1, but it's possible that multiple rows will be returned.
 *
 * Use a type parameter to set the type of the entity that will be returned.
 */
export async function getRecordBySessionId<
  /** The type that will be returned by the function. Must include sessionId key. */
  ReturnType extends SessionIdRecord,
>(
  /** The name of the table in DynamoDB. Probably looks like "some-table-some-stack". */
  tableName: string,
  /** The session ID to search for. */
  sessionId: string,
  logger: Logger,
  opts?: { allowNoEntries?: boolean; allowMultipleEntries?: boolean },
  dynamoClient = new DynamoDBClient()
) {
  const allowNoEntries = opts?.allowNoEntries ?? false;
  const allowMultipleEntries = opts?.allowMultipleEntries ?? false;

  async function queryRecord() {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "sessionId = :value",
      ExpressionAttributeValues: {
        ":value": {
          S: sessionId,
        },
      },
    });

    const result = await dynamoClient.send(command);

    if (!allowNoEntries && (result.Count === 0 || !result.Items)) {
      throw new RecordNotFoundError(tableName, sessionId);
    }

    return result.Items ?? [];
  }

  const queryResult = await withRetry(queryRecord, logger, {
    maxRetries: 3,
    baseDelay: 300,
  });

  const retrievedRecords = queryResult.map((v) => unmarshall(v)) as ReturnType[];

  const validRecords = retrievedRecords.filter((v) => !isRecordExpired(v));

  if (retrievedRecords.length > 0 && validRecords.length === 0) {
    throw new RecordExpiredError(
      tableName,
      sessionId,
      retrievedRecords.map((v) => v.expiryDate ?? v.ttl ?? -1)
    );
  }

  if (!allowMultipleEntries && validRecords.length > 1) {
    throw new TooManyRecordsError(tableName, sessionId, validRecords.length);
  }

  return validRecords;
}
