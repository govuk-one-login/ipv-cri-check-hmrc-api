/**
 * The maximum number of times that the user is allowed to attempt to verify their NINo.
 */
export const MAX_ATTEMPTS = 2;

/**
 * The maximum number of past attempts a user can have in order to allow them to make another attempt.
 *
 * If they have more than this, we do not let them make more attempts.
 */
export const MAX_PAST_ATTEMPTS = MAX_ATTEMPTS - 1;
