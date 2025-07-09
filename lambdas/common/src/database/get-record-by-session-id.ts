import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withRetry } from "../util/retry";
import { RecordNotFoundError, TooManyRecordsError } from "./exceptions/errors";
import { UnixSecondsTimestamp } from "../types/brands";
import { logger } from "../util/logger";

export type SessionIdRecord = { sessionId: string; expiryDate?: UnixSecondsTimestamp };

/**
 * Retrieves a record from DynamoDB, given a table name and session ID.
 * Handles retries and expiry validation, and returns a single valid entry.
 *
 * Use a type parameter to set the type of the entity that will be returned.
 */
export async function getRecordBySessionId<
  /** The type that will be returned by the function. Must include sessionId key. */
  ReturnType extends SessionIdRecord,
>(dynamoClient: DynamoDBClient, tableName: string, sessionId: string, expiryColumn: keyof ReturnType) {
  async function queryRecord() {
    // Use ExpressionAttributeNames as it's possible the expiry column name is a reserved word.
    // Notably, 'ttl' is a reserved word.
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ExpressionAttributeNames.html

    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: `sessionId = :value`,
      FilterExpression: `#expiry > :expiry`,
      ExpressionAttributeNames: {
        "#expiry": String(expiryColumn),
      },
      ExpressionAttributeValues: {
        ":value": {
          S: sessionId,
        },
        ":expiry": {
          N: Math.floor(Date.now() / 1000).toString(),
        },
      },
    });

    const result = await dynamoClient.send(command);

    if (result.Count === 0 || !result.Items) {
      throw new RecordNotFoundError(tableName, sessionId);
    }

    return result.Items;
  }

  const queryResult = await withRetry(queryRecord, logger, {
    maxRetries: 3,
    baseDelay: 300,
  });

  if (queryResult.length > 1) {
    throw new TooManyRecordsError(tableName, sessionId, queryResult.length);
  }

  return unmarshall(queryResult[0]) as ReturnType;
}
