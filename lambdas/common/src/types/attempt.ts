import { ISO8601DateString, UnixSecondsTimestamp } from "@govuk-one-login/cri-types";

export type AttemptItem = {
  sessionId: string;
  timestamp: ISO8601DateString;
  status?: string;
  text?: string;
  attempt: "PASS" | "FAIL";
  ttl: UnixSecondsTimestamp;
};

export type AttemptsResult = {
  count: number;
  items: AttemptItem[];
};
