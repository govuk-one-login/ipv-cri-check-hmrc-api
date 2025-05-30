import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withRetry } from "./util/retry";
import { PersonIdentityItem } from "./types/person-identity";
import { isRecordExpired } from "./util/is-record-expired";
import { RecordExpiredError, RecordNotFoundError } from "./exceptions/errors";

const personIdentityTableName = `person-identity-${process.env.CommonStackName}`;

export async function getPersonIdentity(
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

    if (result.Count !== 1 || !result.Items) {
      throw new RecordNotFoundError("PersonIdentityItem", sessionId);
    }

    return result.Items[0];
  }

  const queryResult = await withRetry(queryPersonIdentity);

  // convert DynamoDB query output into the PersonIdentityItem type
  // eg, { key1: { S: "value1" }, key2: { N: "5" } } => { key1: "value1", key2: 5 }
  const personIdentityItem = unmarshall(queryResult) as PersonIdentityItem;

  if (isRecordExpired(personIdentityItem)) {
    throw new RecordExpiredError(
      "PersonIdentityItem",
      personIdentityItem.sessionId,
      personIdentityItem.expiryDate
    );
  }

  return personIdentityItem;
}
