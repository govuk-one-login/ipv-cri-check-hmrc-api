import { JWK, importJWK, jwtVerify } from "jose";
import { createPublicKey } from "crypto";
import { executeStepFunction } from "../../../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  populateTables,
} from "../../../resources/dynamodb-helper";

import { getSSMParameters } from "../../../resources/ssm-param-helper";
import { getPublicKey } from "../../../resources/kms-helper";
import { createHash } from "crypto";

jest.setTimeout(30_000);

export const environment = process.env.Environment || "localdev";

type EvidenceRequest = {
  scoringPolicy: string;
  strengthScore: number;
};

describe("Nino Check Hmrc Issue Credential", () => {
  let sessionTableName: string;
  let personIdentityTableName: string;
  let commonStackName: string;
  let userAttemptsTable: string;
  let ninoUsersTable: string;
  let ninoIssueCredentialStateMachineArn: string;
  let alg: string | undefined;
  let kmsKeyId: string | undefined;
  let issuer: string | undefined;

  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };
  let hash: string;

  beforeAll(async () => {
    commonStackName = `${process.env.COMMON_STACK_NAME}`;
    userAttemptsTable = `${process.env.USERS_ATTEMPTS_TABLE}`;
    ninoUsersTable = `${process.env.NINO_USERS_TABLE}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    personIdentityTableName = `${process.env.PERSON_IDENTITY_TABLE}`;
    ninoIssueCredentialStateMachineArn = `${process.env.NINO_CREDENTIAL_STATE_MACHINE_ARN}`;

    [kmsKeyId, alg, issuer] = await getSSMParameters(
      `/${commonStackName}/verifiableCredentialKmsSigningKeyId`,
      `/${commonStackName}/clients/ipv-core-stub-aws-build/jwtAuthentication/authenticationAlg`,
      `/${commonStackName}/verifiable-credential/issuer`
    );

    hash = createHash("sha256").update(`${kmsKeyId}`).digest("hex");
  });

  describe("Identity Check passed with success check details", () => {
    beforeEach(async () => {
      await ninoCheckPassedData(
        {
          sessionId: "issue-credential-identity-passed",
          nino: "AA000003D",
        },
        "Bearer identity-check passed",
        {
          scoringPolicy: "gpg45",
          strengthScore: 2,
        }
      );
    });
    afterEach(async () => await clearData("issue-credential-identity-passed"));
    it("should create the valid expiry date", async () => {
      const startExecutionResult = await getExecutionResult(
        "Bearer identity-check passed"
      );
      const token = JSON.parse(startExecutionResult.output as string);
      const [_, payloadEncoded, __] = token.jwt.split(".");
      const payload = JSON.parse(base64decode(payloadEncoded));

      expect(isValidTimestamp(payload.exp)).toBe(true);
      expect(isValidTimestamp(payload.nbf)).toBe(true);
      expect(payload.exp).toBe(payload.nbf + 120 * 60);
    });

    it("should have a VC with a valid signature", async () => {
      const startExecutionResult = await getExecutionResult(
        "Bearer identity-check passed"
      );
      const token = JSON.parse(startExecutionResult.output as string);

      const signingPublicJwk = await createSigningPublicJWK(
        `${kmsKeyId}`,
        `${alg}`
      );
      const publicVerifyingJwk = await importJWK(
        signingPublicJwk,
        signingPublicJwk?.alg || alg
      );

      const { payload } = await jwtVerify(token.jwt, publicVerifyingJwk, {
        algorithms: [`${alg}`],
      });

      const result = await aVcWithCheckDetails();
      expect(isValidTimestamp(payload.exp || 0)).toBe(true);
      expect(isValidTimestamp(payload.nbf || 0)).toBe(true);
      expect(payload).toEqual(result);
    });
    it("should create a VC with a checkDetail, Validity Score of 2 and no Ci", async () => {
      const startExecutionResult = await getExecutionResult(
        "Bearer identity-check passed"
      );

      const token = JSON.parse(startExecutionResult.output as string);

      const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
      const header = JSON.parse(base64decode(headerEncoded));
      const payload = JSON.parse(base64decode(payloadEncoded));

      expect(header).toEqual({
        typ: "JWT",
        alg: "ES256",
        kid: `did:web:review-hc.${environment}.account.gov.uk#${hash}`,
      });

      const result = await aVcWithCheckDetails();
      expect(isValidTimestamp(payload.exp)).toBe(true);
      expect(isValidTimestamp(payload.nbf)).toBe(true);
      expect(payload).toEqual(result);
    });
  });
  describe("Identity Check failed with check details", () => {
    beforeEach(async () => {
      await ninoCheckFailedData(
        {
          sessionId: "issue-credential-identity-failed",
          nino: "AA000003D",
        },
        "Bearer identity-check failed",
        {
          scoringPolicy: "gpg45",
          strengthScore: 2,
        }
      );
    });
    afterEach(async () => await clearData("issue-credential-identity-failed"));

    it("should have a VC with a valid signature", async () => {
      const startExecutionResult = await getExecutionResult(
        "Bearer identity-check failed"
      );
      const token = JSON.parse(startExecutionResult.output as string);

      const signingPublicJwk = await createSigningPublicJWK(
        `${kmsKeyId}`,
        `${alg}`
      );
      const publicVerifyingJwk = await importJWK(
        signingPublicJwk,
        signingPublicJwk?.alg || alg
      );

      const { payload } = await jwtVerify(token.jwt, publicVerifyingJwk, {
        algorithms: [`${alg}`],
      });

      const result = await aVcWithFailedCheckDetailsAndCi();
      expect(isValidTimestamp(payload.exp || 0)).toBe(true);
      expect(isValidTimestamp(payload.nbf || 0)).toBe(true);
      expect(payload).toEqual(result);
    });

    it("should create a VC with a failedCheckDetail, validity score of 0 and Ci", async () => {
      const startExecutionResult = await getExecutionResult(
        "Bearer identity-check failed"
      );

      const token = JSON.parse(startExecutionResult.output as string);

      const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
      const header = JSON.parse(base64decode(headerEncoded));
      const payload = JSON.parse(base64decode(payloadEncoded));

      expect(header).toEqual({
        typ: "JWT",
        alg: "ES256",
        kid: `did:web:review-hc.${environment}.account.gov.uk#${hash}`,
      });

      const result = await aVcWithFailedCheckDetailsAndCi();
      expect(isValidTimestamp(payload.exp)).toBe(true);
      expect(isValidTimestamp(payload.nbf)).toBe(true);
      expect(payload).toEqual(result);
    });
  });

  describe("Record Check passed with success check details", () => {
    beforeEach(async () => {
      await ninoCheckPassedData(
        {
          sessionId: "issue-credential-record-check-passed",
          nino: "AA000003D",
        },
        "Bearer record-check passed"
      );
    });
    afterEach(
      async () => await clearData("issue-credential-record-check-passed")
    );

    it("should create a VC with a checkDetail Record Check with no scores", async () => {
      const startExecutionResult = await getExecutionResult(
        "Bearer record-check passed"
      );

      const token = JSON.parse(startExecutionResult.output as string);

      const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
      const header = JSON.parse(base64decode(headerEncoded));
      const payload = JSON.parse(base64decode(payloadEncoded));

      expect(header).toEqual({
        typ: "JWT",
        alg: "ES256",
        kid: `did:web:review-hc.${environment}.account.gov.uk#${hash}`,
      });

      const result = await aVcWithCheckDetailsDataCheck();
      expect(isValidTimestamp(payload.exp)).toBe(true);
      expect(isValidTimestamp(payload.nbf)).toBe(true);
      expect(payload).toEqual(result);
    });
  });

  describe("Record Check failed with", () => {
    beforeEach(async () => {
      await ninoCheckFailedData(
        {
          sessionId: "issue-credential-record-check-failed",
          nino: "AA000003D",
        },
        "Bearer record-check failed"
      );
    });
    afterEach(
      async () => await clearData("issue-credential-record-check-failed")
    );

    describe("check details no scores", () => {
      it("should create a VC with a failedCheckDetail for Record Check", async () => {
        const startExecutionResult = await getExecutionResult(
          "Bearer record-check failed"
        );

        const token = JSON.parse(startExecutionResult.output as string);

        const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
        const header = JSON.parse(base64decode(headerEncoded));
        const payload = JSON.parse(base64decode(payloadEncoded));

        expect(header).toEqual({
          typ: "JWT",
          alg: "ES256",
          kid: `did:web:review-hc.${environment}.account.gov.uk#${hash}`,
        });

        const result = await aVcWithFailedCheckDetailsRecordCheck();
        expect(isValidTimestamp(payload.exp)).toBe(true);
        expect(isValidTimestamp(payload.nbf)).toBe(true);
        expect(payload).toEqual(result);
      });
    });
  });

  const getExecutionResult = async (token: string) =>
    executeStepFunction(ninoIssueCredentialStateMachineArn as string, {
      bearerToken: token,
    });

  const isValidTimestamp = (timestamp: number) =>
    !isNaN(new Date(timestamp).getTime());

  const base64decode = (value: string) =>
    Buffer.from(value, "base64").toString("utf-8");

  const createSigningPublicJWK = async (
    kid: string,
    alg: string
  ): Promise<JWK> => {
    const publicKey = await getPublicKey(kid as string);
    const key = Buffer.from(publicKey as unknown as Uint8Array);

    const signingPublicJwk = createPublicKey({
      key,
      type: "spki",
      format: "der",
    }).export({ format: "jwk" });

    return {
      ...signingPublicJwk,
      use: "sig",
      kid,
      alg,
    };
  };

  const getBaseVcCredential = async () => {
    return {
      iss: `${issuer}`,
      jti: expect.any(String),
      nbf: expect.any(Number),
      exp: expect.any(Number),
      sub: "test",
      vc: {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
        ],
        credentialSubject: {
          name: [
            {
              nameParts: [
                { type: "GivenName", value: "Jim" },
                { type: "FamilyName", value: "Ferguson" },
              ],
            },
          ],
          birthDate: [
            {
              value: "1948-04-23",
            },
          ],
          socialSecurityRecord: [{ personalNumber: "AA000003D" }],
        },
        type: ["VerifiableCredential", "IdentityCheckCredential"],
      },
    };
  };

  const aVcWithCheckDetails = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            checkDetails: [{ checkMethod: "data" }],
            strengthScore: 2,
            txn: "mock-txn",
            type: "IdentityCheck",
            validityScore: 2,
          },
        ],
      },
    };
  };

  const aVcWithCheckDetailsDataCheck = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            checkDetails: [{ checkMethod: "data", dataCheck: "record_check" }],
            txn: "mock-txn",
            type: "IdentityCheck",
          },
        ],
      },
    };
  };

  const aVcWithFailedCheckDetailsRecordCheck = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            failedCheckDetails: [
              { checkMethod: "data", dataCheck: "record_check" },
            ],
            txn: "mock-txn",
            type: "IdentityCheck",
          },
        ],
      },
    };
  };

  const aVcWithFailedCheckDetailsAndCi = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            failedCheckDetails: [{ checkMethod: "data" }],
            ci: [expect.any(String)],
            strengthScore: 2,
            txn: "mock-txn",
            type: "IdentityCheck",
            validityScore: 0,
          },
        ],
      },
    };
  };

  const getSessionItem = (
    input: {
      sessionId: string;
      nino: string;
    },
    accessToken: string,
    evidenceRequest?: EvidenceRequest
  ): {
    [x: string]: unknown;
  } => ({
    sessionId: input.sessionId,
    accessToken: accessToken,
    authorizationCode: "cd8ff974-d3bc-4422-9b38-a3e5eb24adc0",
    authorizationCodeExpiryDate: "1698925598",
    expiryDate: "9999999999",
    subject: "test",
    clientId: "exampleClientId",
    clientIpAddress: "00.100.8.20",
    clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
    persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
    evidenceRequest,
    txn: "mock-txn",
  });

  const ninoCheckPassedData = async (
    input: {
      sessionId: string;
      nino: string;
    },
    bearerToken: string,
    evidenceRequested?: EvidenceRequest
  ) => {
    await populateTables(
      {
        tableName: ninoUsersTable,
        items: {
          sessionId: input.sessionId,
          nino: input.nino,
        },
      },
      {
        tableName: personIdentityTableName,
        items: {
          sessionId: input.sessionId,
          nino: input.nino,
          birthDates: [{ value: testUser.dob }],
          names: [
            {
              nameParts: [
                {
                  type: "GivenName",
                  value: testUser.firstName,
                },
                {
                  type: "FamilyName",
                  value: testUser.lastName,
                },
              ],
            },
          ],
        },
      },
      {
        tableName: sessionTableName,
        items: getSessionItem(input, bearerToken, evidenceRequested),
      },
      {
        tableName: userAttemptsTable,
        items: {
          sessionId: input.sessionId,
          timestamp: Date.now().toString(),
          attempts: 1,
          outcome: "PASS",
        },
      }
    );
  };
  const ninoCheckFailedData = async (
    input: {
      sessionId: string;
      nino: string;
    },
    bearerToken: string,
    evidenceRequested?: EvidenceRequest
  ) => {
    await populateTables(
      {
        tableName: ninoUsersTable,
        items: {
          sessionId: input.sessionId,
          nino: input.nino,
        },
      },
      {
        tableName: personIdentityTableName,
        items: {
          sessionId: input.sessionId,
          nino: input.nino,
          birthDates: [{ value: testUser.dob }],
          names: [
            {
              nameParts: [
                {
                  type: "GivenName",
                  value: testUser.firstName,
                },
                {
                  type: "FamilyName",
                  value: testUser.lastName,
                },
              ],
            },
          ],
        },
      },
      {
        tableName: sessionTableName,
        items: getSessionItem(input, bearerToken, evidenceRequested),
      },
      {
        tableName: userAttemptsTable,
        items: {
          sessionId: input.sessionId,
          timestamp: Date.now().toString() + 1,
          attempt: "FAIL",
          status: 200,
          text: "DOB does not match CID, First Name does not match CID",
        },
      },
      {
        tableName: userAttemptsTable,
        items: {
          sessionId: input.sessionId,
          timestamp: Date.now().toString(),
          attempt: "FAIL",
          status: 200,
          text: "Nino does not match CID",
        },
      }
    );
  };
  const clearData = async (sessionId: string) => {
    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId },
      },
      {
        tableName: ninoUsersTable,
        items: { sessionId },
      }
    );
    await clearAttemptsTable(sessionId, userAttemptsTable);
  };
});
