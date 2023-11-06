import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import { clearItems, populateTable } from "../resources/dynamodb-helper";

describe("nino-check-happy ", () => {
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
        subject: "test"
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
        id:  "123456789",
        attempts: 1,
        outcome:"PASS",
      },
      output.NinoAttemptsTable
    );
  });

  afterEach(async () => {
    await clearItems(sessionTableName, {
      sessionId: input.sessionId,
    });
    await clearItems(personIdentityTableName, {
      sessionId: input.sessionId,
    });
    await clearItems(output.NinoAttemptsTable as string, {
      id: input.sessionId,
    });
    await clearItems(output.NinoUsersTable as string, {
      sessionId: input.sessionId,
    });
  });

  it("should create signed JWT when nino check is successful", async () => {
    const startExecutionResult = await executeStepFunction(
      {
        "bearerToken": "Bearer test"
      },
      output.NinoIssueCredentialStateMachineArn
    );

   
    const token = JSON.parse(startExecutionResult.output as any);

    
    const [headerEncoded, payloadEncoded, signatureEncoded] = token.jwt.split('.');
    
    const header = decodeBase64(headerEncoded);
    const payload = decodeBase64(payloadEncoded);
    const signature = decodeBase64(signatureEncoded);

    console.log(header);
    console.log(payload);
    console.log(signature);
  });

  function decodeBase64(input: string): string {
    const base64Url = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = input.length % 4;
    const base64 = padding ? base64Url + '=='.substring(0, 4 - padding) : base64Url;
  
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
});
