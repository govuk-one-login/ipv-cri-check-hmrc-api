import { ISO8601DateString, UnixTimestamp } from "../../../common/src/types/brands";

export type AttemptItem = {
  sessionId: string;
  timestamp: ISO8601DateString;
  status?: string;
  text?: string;
  attempt: "PASS" | "FAIL";
  ttl: UnixTimestamp;
};
