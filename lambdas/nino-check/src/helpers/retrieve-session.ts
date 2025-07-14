import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { NinoSessionItem } from "../../../common/src/types/nino-session-item";
import { RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
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
    const session = await getRecordBySessionId<NinoSessionItem>(
      dynamoClient,
      sessionTableName,
      sessionId,
      "expiryDate"
    );

    return session;
  } catch (error) {
    captureMetric(`InvalidSessionErrorMetric`);
    if (error instanceof RecordNotFoundError) {
      throw new CriError(400, `No valid session entry found for the given id`);
    }

    logger.error(`Caught unexpected session retrieval error: ${safeStringifyError(error)}`);

    throw new CriError(400, "Unexpected error getting session information");
  }
}
