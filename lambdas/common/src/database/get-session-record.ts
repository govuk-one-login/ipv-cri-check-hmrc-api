import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withRetry } from "../util/retry";
import { PersonIdentityItem } from "./types/person-identity";
import { isRecordExpired } from "./util/is-record-expired";
import { RecordExpiredError, RecordNotFoundError } from "./exceptions/errors";

const personIdentityTableName = process.env.DYNAMO_TABLE_NAME;

export async function getSessionRecord(
  sessionId: string,
  /** Optional parameter; used for mocking the DynamoDB client when testing. */
  dynamoClient: DynamoDBClient = new DynamoDBClient()
) {
  async function queryPersonIdentity() {
    const command = new QueryCommand({
      TableName: personIdentityTableName,
      KeyConditionExpression: "sessionId = :value",
      ExpressionAttributeValues: {
        ":value": {
          S: sessionId,
        },
      },
    });

    const result = await dynamoClient.send(command);

    if (result.Count === 0 || !result.Items) {
      throw new RecordNotFoundError("PersonIdentityItem", sessionId);
    }

    return result.Items;
  }

  const queryResult = await withRetry(queryPersonIdentity);

  // convert DynamoDB query output into the PersonIdentityItem type
  // eg, { key1: { S: "value1" }, key2: { N: "5" } } => { key1: "value1", key2: 5 }
  const personIdentityItems = queryResult.map((v) =>
    unmarshall(v)
  ) as PersonIdentityItem[];

  const validIdentityItems = personIdentityItems.filter(
    (v) => !isRecordExpired(v)
  );

  if (validIdentityItems.length === 0) {
    throw new RecordExpiredError(
      "PersonIdentityItem",
      sessionId,
      personIdentityItems.map((v) => v.expiryDate)
    );
  }

  return validIdentityItems;
}
