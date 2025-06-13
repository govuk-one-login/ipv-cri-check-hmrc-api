import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { SessionItem } from "../../../common/src/database/types/session-item";
import {
  ISO8601DateString,
  UnixTimestamp,
} from "../../../common/src/types/brands";
import { AttemptItem } from "../../src/types/attempt";

export const mockSessionId = "steve";
export const mockSession: SessionItem = {
  sessionId: mockSessionId,
  expiryDate: 999,
  clientId: "magic",
  clientSessionId: "guy",
  authorizationCodeExpiryDate: 9999999999,
  redirectUri: "https://example.com",
  accessToken: "gimme the stuff",
  accessTokenExpiryDate: 9999999999,
  clientIpAddress: "127.0.0.1",
  subject: "yep",
};
export const mockAttempt: AttemptItem = {
  sessionId: mockSessionId,
  timestamp: new Date().toISOString() as ISO8601DateString,
  attempt: "FAIL",
  ttl: 99999999 as UnixTimestamp,
};
export const mockPersonIdentity: PersonIdentityItem = {
  sessionId: mockSessionId,
  addresses: [],
  names: [],
  birthDates: [],
  expiryDate: 99999,
};

export const mockNino = "AA123456B";
