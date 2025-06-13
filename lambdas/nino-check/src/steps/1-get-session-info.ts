import { TooManyRecordsError } from "../../../common/src/database/exceptions/errors";
import { getRecordBySessionId } from "../../../common/src/database/get-record-by-session-id";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { NinoSessionItem } from "../types/nino-session-item";
import { Helpers, TableNames } from "../types/input";
import { AttemptItem } from "../types/attempt";
import { TooManyAttemptsError } from "../exceptions/errors";
import { MAX_PAST_ATTEMPTS } from "../utils/constants";

export async function getSessionInfo(
  { sessionTable, personIdentityTable, attemptTable }: TableNames,
  { logHelper: { logger } }: Helpers,
  sessionId: string
): Promise<{
  session: NinoSessionItem;
  personIdentity: PersonIdentityItem;
  isFinalAttempt: boolean;
}> {
  const sessions = await getRecordBySessionId<NinoSessionItem>(
    sessionTable,
    sessionId,
    logger
  );

  if (sessions.length > 1) {
    throw new TooManyRecordsError(sessionTable, sessionId, sessions.length);
  } else {
    logger.info(`Retrieved a session for sessionId ${sessionId}.`);
  }

  const session = sessions[0];

  const attempts = await getRecordBySessionId<AttemptItem>(
    attemptTable,
    sessionId,
    logger
  );

  if (attempts.length > MAX_PAST_ATTEMPTS) {
    throw new TooManyAttemptsError(
      sessionId,
      attempts.length,
      MAX_PAST_ATTEMPTS
    );
  }

  const isFinalAttempt = attempts.length === MAX_PAST_ATTEMPTS;

  const personIdentities = await getRecordBySessionId<PersonIdentityItem>(
    personIdentityTable,
    sessionId,
    logger
  );

  if (personIdentities.length > 1) {
    throw new TooManyRecordsError(
      personIdentityTable,
      sessionId,
      sessions.length
    );
  } else {
    logger.info(`Retrieved a person identity for sessionId ${sessionId}.`);
  }

  const personIdentity = personIdentities[0];

  return { session, personIdentity, isFinalAttempt };
}
