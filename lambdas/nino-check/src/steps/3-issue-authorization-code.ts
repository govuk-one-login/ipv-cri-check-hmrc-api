import { randomUUID } from "crypto";
import { TimeUnits, toEpochSecondsFromNow } from "../utils/date-time";
import { updateRecordBySessionId } from "../../../common/src/database/update-record-by-session-id";
import { NinoSessionItem } from "../types/nino-session-item";
import { insertRecord } from "../../../common/src/database/insert-record";
import { Helpers, TableNames } from "../types/input";

export async function issueAuthorizationCode(
  { sessionTable, ninoUserTable }: TableNames,
  { logHelper: { logger }, dynamoClient }: Helpers,
  sessionId: string,
  nino: string
) {
  const authorizationCode = randomUUID();
  const authorizationCodeExpiryDate = toEpochSecondsFromNow(10, TimeUnits.Minutes);

  const authCodeRes = await updateRecordBySessionId<NinoSessionItem>(
    sessionTable,
    {
      sessionId,
      authorizationCode,
      authorizationCodeExpiryDate,
    },
    logger,
    dynamoClient
  );

  logger.info(`Saved auth code: ${authCodeRes.$metadata.httpStatusCode}`);

  const ninoUserRes = await insertRecord(
    ninoUserTable,
    {
      sessionId,
      nino,
    },
    logger,
    dynamoClient
  );

  logger.info(`Saved nino-user: ${ninoUserRes.$metadata.httpStatusCode}`);
}
