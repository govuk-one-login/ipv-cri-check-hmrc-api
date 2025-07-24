import { ISO8601DateString, UnixSecondsTimestamp } from "../../../common/src/types/brands";

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
