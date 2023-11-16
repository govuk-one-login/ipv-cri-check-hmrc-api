import { JWK, importJWK, jwtVerify } from "jose";
import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import { clearItems, populateTable } from "../resources/dynamodb-helper";
import { createPublicKey } from "crypto";
import {
  getSSMParamter,
  ssmParameterUpdate,
} from "../resources/ssm-param-helper";
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

  const decode = (value: string) =>
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

    await populateTable(
      {
        sessionId: "123456789",
        nino: "AA000003D",
      },
      output.NinoUsersTable
    );

    await populateTable(
      {
        sessionId: "123456789",
        accessToken: "Bearer test",
        authorizationCode: "cd8ff974-d3bc-4422-9b38-a3e5eb24adc0",
        authorizationCodeExpiryDate: "1698925598",
        expiryDate: "9999999999",
        subject: "test",
      },
      sessionTableName
    );

    await populateTable(
      {
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
      personIdentityTableName
    );

    await populateTable(
      {
        id: "123456789",
        attempts: 1,
        outcome: "PASS",
      },
      output.NinoAttemptsTable
    );
  });

  afterEach(async () => {
    const tables = [
      sessionTableName,
      personIdentityTableName,
      output.NinoUsersTable,
    ];

    for (const table of tables) {
      await clearItems(table as string, {
        sessionId: input.sessionId,
      });
    }

    await clearItems(output.NinoAttemptsTable as string, {
      id: input.sessionId,
    });
  });

  it("should create signed JWT when nino check is successful", async () => {
    const startExecutionResult = await getExecutionResult("Bearer test");
    const token = JSON.parse(startExecutionResult.output as string);

    const vcKmsSigningKeyId = `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`;
    const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");

    const header = JSON.parse(decode(headerEncoded));
    const payload = JSON.parse(decode(payloadEncoded));

    expect(header).toEqual({
      typ: "JWT",
      alg: "ES256",
      kid: await getSSMParameterValue(vcKmsSigningKeyId),
    });

    expect(isValidTimestamp(payload.exp)).toBe(true);
    expect(isValidTimestamp(payload.nbf)).toBe(true);
    expect(payload).toEqual(expect.objectContaining(expectedPayload));
  });

  it("should create the valid expiry date", async () => {
    const maxJwtTtl = `/${process.env.STACK_NAME}/MaxJwtTtl`;
    const jwtTtlUnit = `/${process.env.STACK_NAME}/JwtTtlUnit`;

    const currentMaxJwtTtl = await getSSMParameterValue(maxJwtTtl);
    const currentJwtTtlUnit = await getSSMParameterValue(jwtTtlUnit);

    await updateSSMParameter({ name: jwtTtlUnit, value: "MINUTES" });
    await updateSSMParameter({ name: maxJwtTtl, value: "5" });

    const startExecutionResult = await getExecutionResult("Bearer test");

    await updateSSMParameter({ name: maxJwtTtl, value: currentMaxJwtTtl });
    await updateSSMParameter({ name: jwtTtlUnit, value: currentJwtTtlUnit });

    const token = JSON.parse(startExecutionResult.output as string);
    const payload = JSON.parse(decode(token.jwt.split(".")[1]));

    expect(payload.exp).toBeCloseTo(payload.nbf + 5 * 1000 * 60);
  });

  it("should have valid signature", async () => {
    const vcKmsSigningKeyId = `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`;
    const authenticationAlg = `/${output.CommonStackName}/clients/ipv-core-stub-aws-build/jwtAuthentication/authenticationAlg`;

    const startExecutionResult = await getExecutionResult("Bearer test");

    const token = JSON.parse(startExecutionResult.output as string);
    const [header, jwtPayload, signature] = token.jwt.split(".");

    const kid = await getSSMParameterValue(vcKmsSigningKeyId);
    const alg = await getSSMParameterValue(authenticationAlg);

    const signingPublicJwk = await createSigningPublicJWK(kid, alg);
    const publicVerifyingJwk = await importJWK(
      signingPublicJwk,
      signingPublicJwk?.alg || alg
    );

    const { payload } = await jwtVerify(
      `${header}.${jwtPayload}.${decode(signature)}`,
      publicVerifyingJwk,
      { algorithms: [alg] }
    );

    expect(isValidTimestamp(payload.exp)).toBe(true);
    expect(isValidTimestamp(payload.nbf)).toBe(true);
    expect(payload).toEqual(expect.objectContaining(expectedPayload));
  });

  async function getExecutionResult(token: string) {
    return await executeStepFunction(
      {
        bearerToken: token,
      },
      output.NinoIssueCredentialStateMachineArn
    );
  }

  async function createSigningPublicJWK(
    kid: string | undefined,
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

  async function getSSMParameterValue(name: string): Promise<string> {
    return (await getSSMParamter({ Name: name })).Parameter?.Value as string;
  }

  async function updateSSMParameter(options: {
    name: string;
    value: string;
    Type?: string;
    Overwrite?: boolean;
  }) {
    const { name, value, Type = "String", Overwrite = true } = options;
    await ssmParameterUpdate({
      Name: name,
      Value: value,
      Type,
      Overwrite,
    });
  }
});
