import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { NinoSessionItem } from "../types/nino-session-item";
import { Helpers, TableNames } from "../types/input";
import { AttemptItem } from "../types/attempt";
import { TooManyAttemptsError } from "../exceptions/errors";
import { MAX_PAST_ATTEMPTS } from "../utils/constants";

export async function getSessionInfo(
  { sessionTable, personIdentityTable, attemptTable }: TableNames,
  { logHelper: { logger }, dynamoClient }: Helpers,
  sessionId: string
): Promise<{
  session: NinoSessionItem;
  personIdentity: PersonIdentityItem;
  isFinalAttempt: boolean;
}> {
  const sessions = await getRecordBySessionId<NinoSessionItem>(sessionTable, sessionId, logger, {}, dynamoClient);

  const session = sessions[0];

  logger.info(`Retrieved a session for sessionId ${sessionId}. Retrieving attempts...`);

  const attempts = await getRecordBySessionId<AttemptItem>(
    attemptTable,
    sessionId,
    logger,
    {
      allowNoEntries: true,
      allowMultipleEntries: true,
      checkExpiryDate: false,
    },
    dynamoClient
  );

  if (attempts.length > MAX_PAST_ATTEMPTS) {
    logger.info(`Too many attempts (${attempts.length} > ${MAX_PAST_ATTEMPTS}).`);
    throw new TooManyAttemptsError(sessionId, attempts.length, MAX_PAST_ATTEMPTS);
  }

  const isFinalAttempt = attempts.length === MAX_PAST_ATTEMPTS;

  logger.info(`Retrieved ${attempts.length} attempts for sessionId ${sessionId}. Retrieving person identity...`);

  const personIdentities = await getRecordBySessionId<PersonIdentityItem>(
    personIdentityTable,
    sessionId,
    logger,
    {},
    dynamoClient
  );

  logger.info(`Retrieved a person identity for sessionId ${sessionId}.`);

  const personIdentity = personIdentities[0];

  return { session, personIdentity, isFinalAttempt };
}
