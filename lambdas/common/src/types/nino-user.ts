import { UnixSecondsTimestamp } from "@govuk-one-login/cri-types";

export type NinoUser = {
  sessionId: string;
  nino: string;
  ttl: UnixSecondsTimestamp;
};
