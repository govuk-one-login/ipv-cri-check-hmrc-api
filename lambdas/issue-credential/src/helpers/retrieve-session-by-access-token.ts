import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { NinoSessionItem } from "../../../common/src/types/nino-session-item";
import { logger } from "../../../common/src/util/logger";
import { CriError } from "../../../common/src/errors/cri-error";
import { safeStringifyError } from "../../../common/src/util/stringify-error";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export async function retrieveSessionByAccessToken(
  sessionTableName: string,
  dynamoClient: DynamoDBClient,
  accessToken: string
): Promise<NinoSessionItem> {
  try {
    const command = new QueryCommand({
      TableName: sessionTableName,
      KeyConditionExpression: "accessToken = :value",
      FilterExpression: "expiryDate > :expiry",
      ExpressionAttributeValues: {
        ":value": {
          S: accessToken,
        },
        ":expiry": {
          N: Math.floor(Date.now() / 1000).toString(),
        },
      },
    });

    const result = await dynamoClient.send(command);

    if (result.Count === 0 || !result.Items) {
      throw new CriError(400, `No session entry found for the given access token`);
    }

    const retrievedRecords = result.Items.map((v) => unmarshall(v)) as NinoSessionItem[];

    if (retrievedRecords.length > 1) {
      throw new CriError(500, `Found ${retrievedRecords.length} session records but was only expecting 1.`);
    }

    return retrievedRecords[0];
  } catch (error) {
    if (error instanceof CriError) throw error;

    logger.error(`Caught unexpected session retrieval error: ${safeStringifyError(error)}`);

    throw new CriError(500, "Unexpected error getting session information");
  }
}
