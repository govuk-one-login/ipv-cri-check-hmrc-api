import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "../../../common/src/util/logger";
import { RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import { CriError } from "../../../common/src/errors/cri-error";
import { safeStringifyError } from "../../../common/src/util/stringify-error";
import { NinoUser } from "../../../common/src/types/nino-user";

export async function retrieveNinoUser(
  ninoUserTableName: string,
  dynamoClient: DynamoDBClient,
  sessionId: string
): Promise<NinoUser> {
  try {
    const ninoUser = await getRecordBySessionId<NinoUser>(dynamoClient, ninoUserTableName, sessionId, "ttl");

    return ninoUser;
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      logger.info(`No valid NINo user record found.`);
      throw new CriError(500, `No NINo user entry found for the given session ID.`);
    }

    logger.error(`Caught unexpected NINo user retrieval error: ${safeStringifyError(error)}`);

    throw new CriError(500, "Unexpected error getting NINo user");
  }
}
