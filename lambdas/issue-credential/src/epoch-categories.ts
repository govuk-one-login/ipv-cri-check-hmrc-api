import { TimeEvent } from "./time-event";
import { milliseconds, toEpochSecondsFromNow } from "./utils/date-time";
export const claimEpochFunction = (event: TimeEvent) => ({
  nbf: toEpochSecondsFromNow(),
  expiry: toEpochSecondsFromNow(event.ttlValue, event?.ttlUnit),
});
export const timeEpochFunction = () => ({
  seconds: toEpochSecondsFromNow(),
  milliseconds: milliseconds(),
});
export const authEpochFunction = (event: TimeEvent) => ({
  authCodeExpiry: toEpochSecondsFromNow(event.ttlValue, event?.ttlUnit),
});
export const getEpochFunctions = () => ({
  claim: claimEpochFunction,
  time: timeEpochFunction,
  auth: authEpochFunction,
});
