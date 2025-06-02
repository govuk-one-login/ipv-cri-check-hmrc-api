import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withRetry } from "../util/retry";
import { isRecordExpired } from "./util/is-record-expired";
import { RecordExpiredError, RecordNotFoundError } from "./exceptions/errors";

/**
 * Retrieves a record from DynamoDB, given a table name and session ID.
 * Handles retries and expiry validation, and returns an array of valid entries.
 * The array will usually have length 1, but it's possible that multiple rows will be returned.
 */
export async function getRecordBySessionId<
  /**
   * The type that will be returned by the function. Must include sessionId and expiryDate keys.
   */
  ReturnType extends { sessionId: string; expiryDate: number },
>(
  /** The name of the table in DynamoDB. Probably looks like "some-table-some-stack". */
  tableName: string,
  /** The session ID to search for. */
  sessionId: string,
  /** Optional parameter; used for mocking the DynamoDB client when testing. */
  dynamoClient: DynamoDBClient = new DynamoDBClient()
) {
  async function queryPersonIdentity() {
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

    if (result.Count === 0 || !result.Items) {
      throw new RecordNotFoundError(tableName, sessionId);
    }

    return result.Items;
  }

  const queryResult = await withRetry(queryPersonIdentity);

  // convert DynamoDB query output into the PersonIdentityItem type
  // eg, { key1: { S: "value1" }, key2: { N: "5" } } => { key1: "value1", key2: 5 }
  const personIdentityItems = queryResult.map((v) =>
    unmarshall(v)
  ) as ReturnType[];

  const validIdentityItems = personIdentityItems.filter(
    (v) => !isRecordExpired(v)
  );

  if (validIdentityItems.length === 0) {
    throw new RecordExpiredError(
      tableName,
      sessionId,
      personIdentityItems.map((v) => v.expiryDate)
    );
  }

  return validIdentityItems;
}
