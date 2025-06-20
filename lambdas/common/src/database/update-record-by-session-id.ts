import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient, UpdateItemCommand, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Nullable } from "../types/nullable";

/**
 * Updates the given record in DynamoDB.
 *
 * - Keys set to some value will be updated.
 * - Keys set to null will be deleted with the DynamoDB UpdateItem REMOVE expression.
 * - Keys left unset or set to undefined will be left as is.
 */
export async function updateRecordBySessionId<T extends { sessionId: string }>(
  tableName: string,
  // permit undefined and null
  record: Partial<Nullable<T>> & { sessionId: string },
  logger: Logger,
  dynamoClient: DynamoDBClient = new DynamoDBClient()
): Promise<UpdateItemCommandOutput> {
  const { sessionId, ...properties } = record;

  // an array of keys set to null
  const deletes = Object.entries(properties)
    .filter(([_, value]) => value === null)
    .map(([key]) => key);

  // the given record, filtered to only values that aren't null or undefined
  const updates = Object.fromEntries(
    Object.entries(properties).filter(([_, value]) => !([null, undefined] as unknown[]).includes(value))
  );

  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.UpdateExpressions.html
  const updateExpression = [
    ...(Object.keys(updates).length > 0
      ? [
          `SET ${Object.entries(updates)
            .map(([key]) => `${key}=:${key}`)
            .join(", ")}`,
        ]
      : []),
    ...(deletes.length > 0 ? [`REMOVE ${deletes.join(", ")}`] : []),
  ].join(" ");

  const txnCmd = new UpdateItemCommand({
    TableName: tableName,
    Key: marshall({ sessionId }),
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: marshall(
      Object.fromEntries(Object.entries(updates).map(([key, value]) => [`:${key}`, value]))
    ),
  });

  const txnRes = await dynamoClient.send(txnCmd);

  return txnRes;
}
