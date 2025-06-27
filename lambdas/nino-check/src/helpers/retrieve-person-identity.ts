import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "../../../common/src/util/logger";
import { RecordExpiredError, RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import { CriError } from "../../../common/src/errors/cri-error";
import { safeStringifyError } from "../../../common/src/util/stringify-error";

export async function retrievePersonIdentity(
  personIdentityTableName: string,
  dynamoClient: DynamoDBClient,
  sessionId: string
): Promise<PersonIdentityItem> {
  try {
    const [personIdentity] = await getRecordBySessionId<PersonIdentityItem>(
      personIdentityTableName,
      sessionId,
      logger,
      {},
      dynamoClient
    );

    return personIdentity;
  } catch (error) {
    if (error instanceof RecordExpiredError) {
      logger.info(`Expired record in person identity table (expiry: ${error.expiryDates.join(", ")})`);
      throw new CriError(500, "Failed to find a valid person identity record for the given session ID.");
    } else if (error instanceof RecordNotFoundError) {
      logger.info(`No valid person identity record found.`);
      throw new CriError(500, `No person identity entry found for the given session ID.`);
    }

    logger.error(`Caught unexpected person identity retrieval error: ${safeStringifyError(error)}`);

    throw new CriError(500, "Unexpected error getting person identity");
  }
}
