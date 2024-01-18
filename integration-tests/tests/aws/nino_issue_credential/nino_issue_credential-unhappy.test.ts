import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  populateTables,
} from "../resources/dynamodb-helper";

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

  it("should fail when nino check is unsuccessful", async () => {
    const startExecutionResult = await executeStepFunction(
      output.NinoIssueCredentialStateMachineArn as string,
      {
        bearerToken: "Bearer unhappy",
      }
    );

    const token = JSON.parse(startExecutionResult.output as string);

    const [headerEncoded, payloadEncoded, signatureEncoded] =
      token.jwt.split(".");

    const header = JSON.parse(atob(headerEncoded));
    const payload = JSON.parse(atob(payloadEncoded));
    const signature = atob(signatureEncoded);

    expect(header.typ).toBe("JWT");
    expect(header.alg).toBe("ES256");
    expect(header.kid).not.toBeNull;

    const evidence = payload.vc.evidence[0];
    expect(evidence.type).toBe("IdentityCheck");
    expect(evidence.strengthScore).toBe(2);
    expect(evidence.validityScore).toBe(0);
    expect(evidence.failedCheckDetails[0].checkMethod).toBe("data");
    expect(evidence.ci[0]).not.toBeNull;
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

    expect(signature).not.toBeNull;
  });

  function isValidTimestamp(timestamp: number): boolean {
    return !isNaN(new Date(timestamp).getTime());
  }
});
