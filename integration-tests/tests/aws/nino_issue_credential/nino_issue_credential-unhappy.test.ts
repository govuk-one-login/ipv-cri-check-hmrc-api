import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  populateTables,
} from "../resources/dynamodb-helper";
import { getSSMParameter } from "../resources/ssm-param-helper";

jest.setTimeout(30_000);

describe("nino-issue-credential-unhappy", () => {
  const input = {
    sessionId: "issue-credential-unhappy",
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
          clientId: "exampleClientId",
        },
      },
      {
        tableName: sessionTableName,
        items: {
          sessionId: input.sessionId,
          accessToken: "Bearer unhappy",
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
  const getExpectedPayload = async () => {
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
        type: ["VerifiableCredential", "IdentityCheckCredential"],
      },
    };
  };
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

  it("should create VC when nino check is unsuccessful", async () => {
    const startExecutionResult = await getExecutionResult("Bearer unhappy");

    const currentCredentialKmsSigningKeyId = await getSSMParameter(
      `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
    );

    const token = JSON.parse(startExecutionResult.output as string);

    const [headerEncoded, payloadEncoded, signatureEncoded] =
      token.jwt.split(".");

    const header = JSON.parse(base64decode(headerEncoded));
    const payload = JSON.parse(base64decode(payloadEncoded));
    const signature = base64decode(signatureEncoded);

    expect(header).toEqual({
      typ: "JWT",
      alg: "ES256",
      kid: currentCredentialKmsSigningKeyId,
    });

    expect(signature).not.toBeNull;
    expect(isValidTimestamp(payload.exp)).toBe(true);
    expect(isValidTimestamp(payload.nbf)).toBe(true);
    expect(payload).toEqual(expect.objectContaining(getExpectedPayload()));
  });

  const getExecutionResult = async (token: string) =>
    executeStepFunction(output.NinoIssueCredentialStateMachineArn as string, {
      bearerToken: token,
    });

  const isValidTimestamp = (timestamp: number) =>
    !isNaN(new Date(timestamp).getTime());

  const base64decode = (value: string) =>
    Buffer.from(value, "base64").toString("utf-8");
});
