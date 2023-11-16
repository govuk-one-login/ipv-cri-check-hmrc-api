import { JWK, importJWK, jwtVerify } from "jose";
import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearItemsFromTables,
  populateTables,
} from "../resources/dynamodb-helper";

import {
  getSSMParameter,
  getSSMParameters,
  updateSSMParameters,
} from "../resources/ssm-param-helper";
import { createPublicKey } from "crypto";
import { getPublicKey } from "../resources/kms-helper";

jest.setTimeout(30_000);

describe("nino-issue-credential-happy", () => {
  const input = {
    sessionId: "123456789",
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
    NinoAttemptsTable: string;
    NinoUsersTable: string;
    NinoIssueCredentialStateMachineArn: string;
  }>;

  const base64decode = (value: string) =>
    Buffer.from(value, "base64").toString("utf-8");
  const isValidTimestamp = (timestamp?: number) =>
    !isNaN(new Date(timestamp as number).getTime());

  const expectedPayload = {
    iss: "0976c11e-8ef3-4659-b7f2-ee0b842b85bd",
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
      type: ["VerifiableCredential", "IdentityCheckCredential"],
    },
  };

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;

    await populateTables(
      {
        tableName: output.NinoUsersTable as string,
        items: {
          sessionId: "123456789",
          nino: "AA000003D",
        },
      },
      {
        tableName: sessionTableName,
        items: {
          sessionId: "123456789",
          accessToken: "Bearer test",
          authorizationCode: "cd8ff974-d3bc-4422-9b38-a3e5eb24adc0",
          authorizationCodeExpiryDate: "1698925598",
          expiryDate: "9999999999",
          subject: "test",
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
        tableName: output.NinoAttemptsTable as string,
        items: {
          id: "123456789",
          attempts: 1,
          outcome: "PASS",
        },
      }
    );
  });

  afterEach(
    async () =>
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
        },
        {
          tableName: output.NinoAttemptsTable as string,
          items: { id: input.sessionId },
        }
      )
  );

  it("should create signed JWT when nino check is successful", async () => {
    const startExecutionResult = await getExecutionResult("Bearer test");

    const token = JSON.parse(startExecutionResult.output as string);

    const vcKmsSigningKeyId = `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`;
    const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");

    const header = JSON.parse(base64decode(headerEncoded));
    const payload = JSON.parse(base64decode(payloadEncoded));

    expect(header).toEqual({
      typ: "JWT",
      alg: "ES256",
      kid: await getSSMParameter(vcKmsSigningKeyId),
    });

    expect(isValidTimestamp(payload.exp)).toBe(true);
    expect(isValidTimestamp(payload.nbf)).toBe(true);
    expect(payload).toEqual(expect.objectContaining(expectedPayload));
  });

  it("should create the valid expiry date", async () => {
    const maxJwtTtl = `/${process.env.STACK_NAME}/MaxJwtTtl`;
    const jwtTtlUnit = `/${process.env.STACK_NAME}/JwtTtlUnit`;

    const [currentMaxJwtTtl, currentJwtTtlUnit] = await getSSMParameters(
      maxJwtTtl,
      jwtTtlUnit
    );

    await updateSSMParameters(
      { name: maxJwtTtl, value: "5" },
      { name: jwtTtlUnit, value: "MINUTES" }
    );

    const startExecutionResult = await getExecutionResult("Bearer test");

    await updateSSMParameters(
      { name: maxJwtTtl, value: currentMaxJwtTtl as string },
      { name: jwtTtlUnit, value: currentJwtTtlUnit as string }
    );

    const token = JSON.parse(startExecutionResult.output as string);
    const payload = JSON.parse(base64decode(token.jwt.split(".")[1]));

    expect(payload.exp).toBeCloseTo(payload.nbf + 5 * 1000 * 60);
  });

  it("should have valid signature", async () => {
    const vcKmsSigningKeyId = `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`;
    const authenticationAlg = `/${output.CommonStackName}/clients/ipv-core-stub-aws-build/jwtAuthentication/authenticationAlg`;

    const startExecutionResult = await getExecutionResult("Bearer test");

    const token = JSON.parse(startExecutionResult.output as string);
    const [header, jwtPayload, signature] = token.jwt.split(".");

    const kid = (await getSSMParameter(vcKmsSigningKeyId)) as string;
    const alg = (await getSSMParameter(authenticationAlg)) as string;

    const signingPublicJwk = await createSigningPublicJWK(kid, alg);
    const publicVerifyingJwk = await importJWK(
      signingPublicJwk,
      signingPublicJwk?.alg || alg
    );

    const { payload } = await jwtVerify(
      `${header}.${jwtPayload}.${base64decode(signature)}`,
      publicVerifyingJwk,
      { algorithms: [alg] }
    );

    expect(isValidTimestamp(payload.exp)).toBe(true);
    expect(isValidTimestamp(payload.nbf)).toBe(true);
    expect(payload).toEqual(expect.objectContaining(expectedPayload));
  });

  async function getExecutionResult(token: string) {
    return await executeStepFunction(
      output.NinoIssueCredentialStateMachineArn as string,
      {
        bearerToken: token,
      }
    );
  }

  async function createSigningPublicJWK(
    kid: string,
    alg: string
  ): Promise<JWK> {
    const key = Buffer.from(
      (await getPublicKey(kid as string)).PublicKey as Uint8Array
    );

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
  }
});
