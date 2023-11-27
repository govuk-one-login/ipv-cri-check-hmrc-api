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
    const startExecutionResult = await executeStepFunction(
      output.NinoIssueCredentialStateMachineArn as string,
      {
        bearerToken: "Bearer test",
      }
    );

    const verifiableCredentialKmsSigningKeyId = `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`;

    const currentCredentialKmsSigningKeyId = await getSSMParameter(
      verifiableCredentialKmsSigningKeyId
    );

    const token = JSON.parse(startExecutionResult.output as string);

    const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");

    const header = JSON.parse(atob(headerEncoded));
    const payload = JSON.parse(atob(payloadEncoded));

    expect(header.typ).toBe("JWT");
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe(currentCredentialKmsSigningKeyId);

    const evidence = payload.vc.evidence[0];
    expect(evidence.type).toBe("IdentityCheck");
    expect(evidence.strengthScore).toBe(2);
    expect(evidence.validityScore).toBe(2);
    expect(evidence.checkDetails[0].checkMethod).toBe("data");
    expect(evidence.checkDetails[0].identityCheckPolicy).toBe("published");
    expect(evidence.txn).not.toBeNull;

    const credentialSubject = payload.vc.credentialSubject;
    expect(credentialSubject.socialSecurityRecord[0].personalNumber).toBe(
      testUser.nino
    );
    expect(credentialSubject.name[0].nameParts[0].type).toBe("GivenName");
    expect(credentialSubject.name[0].nameParts[0].value).toBe(
      testUser.firstName
    );
    expect(credentialSubject.name[0].nameParts[1].type).toBe("FamilyName");
    expect(credentialSubject.name[0].nameParts[1].value).toBe(
      testUser.lastName
    );

    expect(payload.vc.type[0]).toBe("VerifiableCredential");
    expect(payload.vc.type[1]).toBe("IdentityCheckCredential");

    expect(payload.vc["@context"][0]).toBe(
      "https://www.w3.org/2018/credentials/v1"
    );
    expect(payload.vc["@context"][1]).toBe(
      "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld"
    );

    expect(payload.sub).not.toBeNull;
    expect(isValidTimestamp(payload.nbf)).toBe(true);
    expect(payload.iss).not.toBeNull;
    expect(isValidTimestamp(payload.exp)).toBe(true);
    expect(payload.jti).not.toBeNull;
  });

  it("should create the valid expiry date", async () => {
    const maxJwtTtl = `/${process.env.STACK_NAME}/MaxJwtTtl`;
    const jwtTtlUnit = `/${process.env.STACK_NAME}/JwtTtlUnit`;

    const [currentMaxJwtTtl, currentJwtTtlUnit] = await getSSMParameters(
      `/${process.env.STACK_NAME}/MaxJwtTtl`,
      `/${process.env.STACK_NAME}/JwtTtlUnit`
    );

    await updateSSMParameters(
      { name: maxJwtTtl, value: "5" },
      { name: jwtTtlUnit, value: "MINUTES" }
    );

    const startExecutionResult = await executeStepFunction(
      output.NinoIssueCredentialStateMachineArn as string,
      {
        bearerToken: "Bearer test",
      }
    );

    await updateSSMParameters(
      { name: maxJwtTtl, value: currentMaxJwtTtl as string },
      { name: jwtTtlUnit, value: currentJwtTtlUnit as string }
    );

    const token = JSON.parse(startExecutionResult.output as string);

    const payloadEncoded = token.jwt.split(".")[1];

    const payload = JSON.parse(atob(payloadEncoded));

    expect(payload.exp).toBe(payload.nbf + 5 * 1000 * 60);
  });

  const isValidTimestamp = (timestamp: number) =>
    !isNaN(new Date(timestamp).getTime());
});
