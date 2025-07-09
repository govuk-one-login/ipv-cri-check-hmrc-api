import { UnixSecondsTimestamp } from "./brands";

export type NinoUser = {
  sessionId: string;
  nino: string;
  ttl: UnixSecondsTimestamp;
};
