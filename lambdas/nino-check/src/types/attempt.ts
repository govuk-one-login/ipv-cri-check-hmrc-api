import { ISO8601DateString, UnixTimestamp } from "../../../common/src/types/brands";

export type AttemptItem = {
  sessionId: string;
  timestamp: ISO8601DateString;
  attempt: "PASS" | "FAIL";
  ttl: UnixTimestamp;
};
