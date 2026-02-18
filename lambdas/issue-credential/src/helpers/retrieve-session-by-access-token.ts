import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { AccessTokenIndexSessionItem } from "../../../common/src/types/access-token-index-session-item";
import { logger } from "@govuk-one-login/cri-logger";;
import { CriError } from "@govuk-one-login/cri-error-response";
import { safeStringifyError } from "../../../common/src/util/stringify-error";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { withRetry } from "../../../common/src/util/retry";

export async function retrieveSessionIdByAccessToken(
  sessionTableName: string,
  dynamoClient: DynamoDBClient,
  accessToken: string
): Promise<string> {
  try {
    async function sendQueryCommand() {
      const command = new QueryCommand({
        TableName: sessionTableName,
        IndexName: "access-token-index",
        KeyConditionExpression: "accessToken = :value",
        ExpressionAttributeValues: {
          ":value": {
            S: accessToken,
          },
        },
      });

      const result = await dynamoClient.send(command);

      if (result.Count === 0 || !result.Items) {
        throw new CriError(400, `No session entry found for the given access token`);
      }

      const retrievedRecords = result.Items.map((v) => unmarshall(v)) as AccessTokenIndexSessionItem[];

      if (retrievedRecords.length > 1) {
        throw new CriError(500, `Found ${retrievedRecords.length} session records but was only expecting 1.`);
      }

      return retrievedRecords[0].sessionId;
    }

    return await withRetry(sendQueryCommand, {
      maxRetries: 3,
      baseDelay: 300,
    });
  } catch (error) {
    if (error instanceof CriError) throw error;

    logger.error(`Caught unexpected session retrieval error: ${safeStringifyError(error)}`);

    throw new CriError(500, "Unexpected error getting session information");
  }
}
