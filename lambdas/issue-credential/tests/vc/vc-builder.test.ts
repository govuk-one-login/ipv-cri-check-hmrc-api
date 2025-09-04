import { buildVerifiableCredential } from "../../src/vc/vc-builder";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { NinoUser } from "../../../common/src/types/nino-user";
import { VerifiableIdentityCredential, VerifiableCredential } from "../../src/types/verifiable-credential";
import { AttemptItem, AttemptsResult } from "../../../common/src/types/attempt";
import { SessionItem } from "../../../common/src/database/types/session-item";

describe("vc-builder", () => {
  const sessionId = "test-session";
  const passedAttempt: AttemptsResult = {
    count: 1,
    items: [{ sessionId, attempt: "PASS", status: "200" } as AttemptItem],
  };
  const failedAttempt = {
    count: 2,
    items: [
      { sessionId, attempt: "FAIL", text: "failed check 1, failed check 2" } as AttemptItem,
      { sessionId, attempt: "FAIL", text: "failed check 1, failed check 2" } as AttemptItem,
    ],
    failedItems: [
      { sessionId, attempt: "FAIL", text: "failed check 1, failed check 2" } as AttemptItem,
      { sessionId, attempt: "FAIL", text: "failed check 1, failed check 2" } as AttemptItem,
    ],
  };
  const mockPersonIdentity: PersonIdentityItem = {
    sessionId,
    socialSecurityRecord: [{ personalNumber: "AA000003D" }],
    names: [
      {
        nameParts: [
          { type: "GivenName", value: "Jim" },
          { type: "FamilyName", value: "Ferguson" },
        ],
      },
    ],
    birthDates: [{ value: "1948-04-23" }],
  } as PersonIdentityItem;

  const mockNinoUser: NinoUser = {
    sessionId,
    nino: "AA000003D",
  } as NinoUser;

  const mockJwtClaims: VerifiableIdentityCredential = {
    iss: "https://review-hc.dev.account.gov.uk",
    jti: "urn:uuid:f540b78c-9e52-4a0f-b033-c78e7ab327ea",
    nbf: 1710396563,
    exp: 1710403763,
    sub: "test",
    vc: {} as VerifiableCredential,
  };

  describe("buildVcClaimSet", () => {
    const evidenceRequest = {
      scoringPolicy: "gpg45",
      strengthScore: 2,
    };
    it("creates VC with checkDetails when user has passed with score 2 and strength 2", () => {
      const session: SessionItem = {
        sessionId: "test-session",
        txn: "mock-txn",
        evidenceRequest,
      } as SessionItem;

      const result = buildVerifiableCredential(
        passedAttempt,
        mockPersonIdentity as PersonIdentityItem,
        mockNinoUser as NinoUser,
        session,
        mockJwtClaims,
        []
      );

      expect(result).toEqual({
        exp: 1710403763,
        iss: "https://review-hc.dev.account.gov.uk",
        jti: "urn:uuid:f540b78c-9e52-4a0f-b033-c78e7ab327ea",
        nbf: 1710396563,
        sub: "test",
        vc: {
          "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
          ],
          credentialSubject: {
            birthDate: [{ value: "1948-04-23" }],
            name: [
              {
                nameParts: [
                  { type: "GivenName", value: "Jim" },
                  { type: "FamilyName", value: "Ferguson" },
                ],
              },
            ],
            socialSecurityRecord: [{ personalNumber: "AA000003D" }],
          },
          evidence: [
            {
              checkDetails: [{ checkMethod: "data" }],
              strengthScore: 2,
              txn: "mock-txn",
              type: "IdentityCheck",
              validityScore: 2,
            },
          ],
          type: ["VerifiableCredential", "IdentityCheckCredential"],
        },
      });
    });
    it("creates VC with failedCheckDetails and ci non-existent, when user has failed with score 0 and strength 2", () => {
      const session: SessionItem = {
        sessionId: "test-session",
        txn: "mock-txn",
        evidenceRequest,
      } as SessionItem;

      const result = buildVerifiableCredential(
        failedAttempt,
        mockPersonIdentity,
        mockNinoUser,
        session,
        mockJwtClaims,
        []
      );

      expect(result).toEqual({
        exp: 1710403763,
        iss: "https://review-hc.dev.account.gov.uk",
        jti: "urn:uuid:f540b78c-9e52-4a0f-b033-c78e7ab327ea",
        nbf: 1710396563,
        sub: "test",
        vc: {
          "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
          ],
          credentialSubject: {
            birthDate: [{ value: "1948-04-23" }],
            name: [
              {
                nameParts: [
                  { type: "GivenName", value: "Jim" },
                  { type: "FamilyName", value: "Ferguson" },
                ],
              },
            ],
            socialSecurityRecord: [{ personalNumber: "AA000003D" }],
          },
          evidence: [
            {
              ci: [],
              failedCheckDetails: [{ checkMethod: "data" }],
              strengthScore: 2,
              txn: "mock-txn",
              type: "IdentityCheck",
              validityScore: 0,
            },
          ],
          type: ["VerifiableCredential", "IdentityCheckCredential"],
        },
      });
    });

    it("creates VC with failedCheckDetails and ci with values, when user has failed with score 0 and strength 2", () => {
      const session: SessionItem = {
        sessionId: "test-session",
        txn: "mock-txn",
        evidenceRequest,
      } as SessionItem;

      const result = buildVerifiableCredential(
        failedAttempt,
        mockPersonIdentity,
        mockNinoUser,
        session,
        mockJwtClaims,
        [{ ci: "ci_3", reason: "ci_3 reason" }]
      );

      expect(result).toEqual({
        exp: 1710403763,
        iss: "https://review-hc.dev.account.gov.uk",
        jti: "urn:uuid:f540b78c-9e52-4a0f-b033-c78e7ab327ea",
        nbf: 1710396563,
        sub: "test",
        vc: {
          "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
          ],
          credentialSubject: {
            birthDate: [{ value: "1948-04-23" }],
            name: [
              {
                nameParts: [
                  { type: "GivenName", value: "Jim" },
                  { type: "FamilyName", value: "Ferguson" },
                ],
              },
            ],
            socialSecurityRecord: [{ personalNumber: "AA000003D" }],
          },
          evidence: [
            {
              ci: ["ci_3"],
              failedCheckDetails: [{ checkMethod: "data" }],
              strengthScore: 2,
              txn: "mock-txn",
              type: "IdentityCheck",
              validityScore: 0,
            },
          ],
          type: ["VerifiableCredential", "IdentityCheckCredential"],
        },
      });
    });
  });

  it("preserves JWT claims in the result", () => {
    const session: SessionItem = {
      sessionId: "test-session",
      txn: "mock-txn",
    } as SessionItem;

    const result = buildVerifiableCredential(
      passedAttempt,
      mockPersonIdentity,
      mockNinoUser,
      session,
      mockJwtClaims,
      []
    );

    expect(result.iss).toBe(mockJwtClaims.iss);
    expect(result.jti).toBe(mockJwtClaims.jti);
    expect(result.nbf).toBe(mockJwtClaims.nbf);
    expect(result.exp).toBe(mockJwtClaims.exp);
    expect(result.sub).toBe(mockJwtClaims.sub);
  });
});
