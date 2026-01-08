import { PersonIdentityItem } from "@govuk-one-login/cri-types";
import { ISO8601DateString } from "@govuk-one-login/cri-types";
import { AttemptItem } from "../../../common/src/types/attempt";
import { NinoUser } from "../../../common/src/types/nino-user";
import { AccessTokenIndexSessionItem } from "../../src/types/access-token-index-session-item";
import { SessionItem, UnixMillisecondsTimestamp, UnixSecondsTimestamp } from "@govuk-one-login/cri-types";

export const mockTxn = "very good";

export const mockSessionId = "steve";
export const mockAccessToken = "g1mme-The_stuff";
export const mockNino = "AA123456B";

const expiryDate = 9999999999 as UnixSecondsTimestamp;

export const mockSession: SessionItem = {
  sessionId: mockSessionId,
  attemptCount: 1,
  createdDate: 9999999999 as UnixMillisecondsTimestamp,
  expiryDate,
  state: "",
  clientId: "magic",
  clientSessionId: "guy",
  authorizationCodeExpiryDate: 9999999999 as UnixSecondsTimestamp,
  redirectUri: "https://example.com",
  accessToken: mockAccessToken,
  accessTokenExpiryDate: 9999999999 as UnixSecondsTimestamp,
  clientIpAddress: "127.0.0.1",
  subject: "yarp",
  txn: "narp",
};

export const mockSessionFromIndex: AccessTokenIndexSessionItem = {
  sessionId: mockSessionId,
  accessToken: mockAccessToken,
  subject: "yarp",
};

export const mockAttempt: AttemptItem = {
  sessionId: mockSessionId,
  timestamp: new Date().toISOString() as ISO8601DateString,
  attempt: "FAIL",
  ttl: expiryDate,
};

export const mockPersonIdentity: PersonIdentityItem = {
  sessionId: mockSessionId,
  addresses: [],
  names: [
    {
      nameParts: [
        {
          type: "GivenName",
          value: "Billybob",
        },
        {
          type: "FamilyName",
          value: "Jones",
        },
      ],
    },
  ],
  birthDates: [{ value: "2000-01-01" }],
  expiryDate,
};

export const mockNinoUser: NinoUser = {
  sessionId: mockSessionId,
  nino: mockNino,
  ttl: expiryDate,
};
