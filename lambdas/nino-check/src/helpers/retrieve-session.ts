import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { NinoSessionItem } from "../types/nino-session-item";
import { RecordExpiredError, RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "../../../common/src/util/logger";
import { CriError } from "../../../common/src/errors/cri-error";
import { captureMetric } from "../../../common/src/util/metrics";
import { safeStringifyError } from "../../../common/src/util/stringify-error";

export async function retrieveSession(
  sessionTableName: string,
  dynamoClient: DynamoDBClient,
  sessionId: string
): Promise<NinoSessionItem> {
  try {
    const [session] = await getRecordBySessionId<NinoSessionItem>(
      sessionTableName,
      sessionId,
      logger,
      {},
      dynamoClient
    );

    return session;
  } catch (error) {
    captureMetric(`InvalidSessionErrorMetric`);
    if (error instanceof RecordExpiredError) {
      logger.info(`Expired record in session table (expiry: ${error.expiryDates.join(", ")})`);
      throw new CriError(400, "Failed to find a valid session record for the given session ID.");
    } else if (error instanceof RecordNotFoundError) {
      throw new CriError(400, `No valid session entry found for the given id`);
    }

    logger.error(`Caught unexpected session retrieval error: ${safeStringifyError(error)}`);

    throw new CriError(400, "Unexpected error getting session information");
  }
}
