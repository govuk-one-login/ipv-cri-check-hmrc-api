import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { AttemptItem } from "../types/attempt";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "../../../common/src/util/logger";

export async function retrieveAttempts(
  attemptTable: string,
  dynamoClient: DynamoDBClient,
  sessionId: string
): Promise<number> {
  const attempts = await getRecordBySessionId<AttemptItem>(
    attemptTable,
    sessionId,
    logger,
    {
      allowNoEntries: true,
      allowMultipleEntries: true,
    },
    dynamoClient
  );

  return attempts.length;
}
