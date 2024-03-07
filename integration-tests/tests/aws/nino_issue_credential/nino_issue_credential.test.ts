import { JWK, importJWK, jwtVerify } from "jose";
import { createPublicKey } from "crypto";
import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  populateTables,
} from "../resources/dynamodb-helper";

import { getSSMParameter } from "../resources/ssm-param-helper";
import { getPublicKey } from "../resources/kms-helper";

jest.setTimeout(30_000);

describe("nino-issue-credential-happy", () => {
  const input = {
    sessionId: "issue-credential-happy",
    nino: "AA000003D",
  };

  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };

  let sessionTableName: string;
  let personIdentityTableName: string;

  let output: Partial<{
    CommonStackName: string;
    UserAttemptsTable: string;
    NinoUsersTable: string;
    NinoIssueCredentialStateMachineArn: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;

    await populateTables(
      {
        tableName: output.NinoUsersTable as string,
        items: {
          sessionId: input.sessionId,
          nino: "AA000003D",
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
      }
    );
  });
  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: output.NinoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );
    await clearAttemptsTable(input.sessionId, output.UserAttemptsTable);
  });

  describe("Nino check is successful", () => {
    beforeEach(async () => {
      await populateTables(
        {
          tableName: sessionTableName,
          items: getSessionItem(input, "Bearer happy"),
        },
        {
          tableName: output.UserAttemptsTable as string,
          items: {
            sessionId: input.sessionId,
            timestamp: Date.now().toString(),
            attempts: 1,
            outcome: "PASS",
          },
        }
      );
    });

    it("should create the valid expiry date", async () => {
      const startExecutionResult = await getExecutionResult("Bearer happy");
      const token = JSON.parse(startExecutionResult.output as string);
      const [_, payloadEncoded, __] = token.jwt.split(".");
      const payload = JSON.parse(base64decode(payloadEncoded));

      expect(isValidTimestamp(payload.exp)).toBe(true);
      expect(isValidTimestamp(payload.nbf)).toBe(true);
      expect(payload.exp).toBe(payload.nbf + 120 * 60);
    });

    it("should have a VC with a valid signature", async () => {
      const kid = (await getSSMParameter(
        `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
      )) as string;
      const alg = (await getSSMParameter(
        `/${output.CommonStackName}/clients/ipv-core-stub-aws-build/jwtAuthentication/authenticationAlg`
      )) as string;

      const startExecutionResult = await getExecutionResult("Bearer happy");
      const token = JSON.parse(startExecutionResult.output as string);

      const signingPublicJwk = await createSigningPublicJWK(kid, alg);
      const publicVerifyingJwk = await importJWK(
        signingPublicJwk,
        signingPublicJwk?.alg || alg
      );

      const { payload } = await jwtVerify(token.jwt, publicVerifyingJwk, {
        algorithms: [alg],
      });

      expect(isValidTimestamp(payload.exp || 0)).toBe(true);
      expect(isValidTimestamp(payload.nbf || 0)).toBe(true);
      expect(payload).toEqual(
        expect.objectContaining(aVcWithCheckDetailsAndNoCi())
      );
    });
    it("should create a VC with a checkDetail, Validity Score of 2 and no Ci", async () => {
      const startExecutionResult = await getExecutionResult("Bearer happy");

      const currentCredentialKmsSigningKeyId = await getSSMParameter(
        `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
      );

      const token = JSON.parse(startExecutionResult.output as string);

      const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
      const header = JSON.parse(base64decode(headerEncoded));
      const payload = JSON.parse(base64decode(payloadEncoded));

      expect(header).toEqual({
        typ: "JWT",
        alg: "ES256",
        kid: currentCredentialKmsSigningKeyId,
      });
      expect(isValidTimestamp(payload.exp)).toBe(true);
      expect(isValidTimestamp(payload.nbf)).toBe(true);
      expect(payload).toEqual(
        expect.objectContaining(aVcWithCheckDetailsAndNoCi())
      );
    });
  });
  describe("Nino check is unsuccessful", () => {
    beforeEach(async () => {
      await populateTables(
        {
          tableName: sessionTableName,
          items: getSessionItem(input, "Bearer unhappy"),
        },
        {
          tableName: output.UserAttemptsTable as string,
          items: {
            sessionId: input.sessionId,
            timestamp: Date.now().toString() + 1,
            attempt: "FAIL",
            status: 200,
            text: "DOB does not match CID, First Name does not match CID",
          },
        },
        {
          tableName: output.UserAttemptsTable as string,
          items: {
            sessionId: input.sessionId,
            timestamp: Date.now().toString(),
            attempt: "FAIL",
            status: 200,
            text: "DOB does not match CID, First Name does not match CID",
          },
        }
      );
    });

    it("should have a VC with a valid signature", async () => {
      const kid = (await getSSMParameter(
        `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
      )) as string;
      const alg = (await getSSMParameter(
        `/${output.CommonStackName}/clients/ipv-core-stub-aws-build/jwtAuthentication/authenticationAlg`
      )) as string;

      const startExecutionResult = await getExecutionResult("Bearer unhappy");
      const token = JSON.parse(startExecutionResult.output as string);

      const signingPublicJwk = await createSigningPublicJWK(kid, alg);
      const publicVerifyingJwk = await importJWK(
        signingPublicJwk,
        signingPublicJwk?.alg || alg
      );

      const { payload } = await jwtVerify(token.jwt, publicVerifyingJwk, {
        algorithms: [alg],
      });

      expect(isValidTimestamp(payload.exp || 0)).toBe(true);
      expect(isValidTimestamp(payload.nbf || 0)).toBe(true);
      expect(payload).toEqual(
        expect.objectContaining(aVcWithFailedCheckDetailAndCi())
      );
    });

    it("should create a VC with a failedCheckDetail, validity score of 0 and Ci", async () => {
      const startExecutionResult = await getExecutionResult("Bearer unhappy");

      const currentCredentialKmsSigningKeyId = await getSSMParameter(
        `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
      );

      const token = JSON.parse(startExecutionResult.output as string);

      const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
      const header = JSON.parse(base64decode(headerEncoded));
      const payload = JSON.parse(base64decode(payloadEncoded));

      expect(header).toEqual({
        typ: "JWT",
        alg: "ES256",
        kid: currentCredentialKmsSigningKeyId,
      });
      expect(isValidTimestamp(payload.exp)).toBe(true);
      expect(isValidTimestamp(payload.nbf)).toBe(true);
      expect(payload).toEqual(
        expect.objectContaining(aVcWithFailedCheckDetailAndCi())
      );
    });
  });
  const getExecutionResult = async (token: string) =>
    executeStepFunction(output.NinoIssueCredentialStateMachineArn as string, {
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
    const issuer = await getSSMParameter(
      `/${output.CommonStackName}/verifiable-credential/issuer`
    );
    return {
      iss: `${issuer}`,
      jti: expect.any(String),
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
          socialSecurityRecord: [{ personalNumber: "AA000003D" }],
        },
        type: ["VerifiableCredential", "IdentityCheckCredential"],
      },
    };
  };

  const aVcWithCheckDetailsAndNoCi = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            checkDetails: [
              { checkMethod: "data", identityCheckPolicy: "published" },
            ],
            strengthScore: 2,
            txn: expect.any(String),
            type: "IdentityCheck",
            validityScore: 2,
          },
        ],
      },
    };
  };

  const aVcWithFailedCheckDetailAndCi = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            failedCheckDetails: [
              { checkMethod: "data", identityCheckPolicy: "published" },
            ],
            strengthScore: 2,
            txn: expect.any(String),
            type: "IdentityCheck",
            validityScore: 0,
          },
        ],
        ci: [expect.any(String)],
      },
    };
  };

  const getSessionItem = (
    input: {
      sessionId: string;
      nino: string;
    },
    accessToken: string
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
  });
});
