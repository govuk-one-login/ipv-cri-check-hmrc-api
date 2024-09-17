import { TimeEvent } from "./time-event";
import { milliseconds, toEpochSecondsFromNow } from "./utils/date-time";
type EpochFunction = (event: TimeEvent) => object;
export type EpochFunctionMap = Record<string, EpochFunction>;
export const generateClaimEpoch = (event: TimeEvent) => ({
  nbf: toEpochSecondsFromNow(),
  expiry: toEpochSecondsFromNow(event.ttlValue, event?.ttlUnit),
});
export const generateCurrentTimeEpoch = () => ({
  seconds: toEpochSecondsFromNow(),
  milliseconds: milliseconds(),
});
export const generateAuthCodeEpoch = (event: TimeEvent) => ({
  authCodeExpiry: toEpochSecondsFromNow(event.ttlValue, event?.ttlUnit),
});
export const getEpochFunctionMap = (): EpochFunctionMap => ({
  claim: generateClaimEpoch,
  time: generateCurrentTimeEpoch,
  auth: generateAuthCodeEpoch,
});
