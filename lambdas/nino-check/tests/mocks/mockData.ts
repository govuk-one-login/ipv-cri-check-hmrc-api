import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { ISO8601DateString, UnixTimestamp } from "../../../common/src/types/brands";
import { AttemptItem } from "../../src/types/attempt";
import { NinoSessionItem } from "../../src/types/nino-session-item";

export const mockTxn = "very good";

export const mockSessionId = "steve";
export const mockSession: NinoSessionItem = {
  sessionId: mockSessionId,
  expiryDate: 999,
  clientId: "magic",
  clientSessionId: "guy",
  authorizationCodeExpiryDate: 9999999999,
  redirectUri: "https://example.com",
  accessToken: "gimme the stuff",
  accessTokenExpiryDate: 9999999999,
  clientIpAddress: "127.0.0.1",
  subject: "yarp",
  txn: "narp",
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
  expiryDate: 99999,
};

export const mockNino = "AA123456B";

export const mockOtgToken = "gimme access";

export const mockPdvRes = {
  httpStatus: 200,
  body: "cool stuff",
  parsedBody: {
    firstName: "bob",
    lastName: "jenkins",
    nino: "AA123456B",
    dateOfBirth: "1994-09-24",
  },
  txn: "good",
};
