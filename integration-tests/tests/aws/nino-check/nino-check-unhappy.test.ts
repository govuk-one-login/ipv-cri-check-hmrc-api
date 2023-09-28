import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import { clearItems, populateTable } from "../resources/dynamodb-helper";

describe("nino-check-unhappy ", () => {
  const input = {
    sessionId: "123456789",
    nino: "AB123003C",
  };

  const testUser = {
    nino: "AB123003C",
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
    NinoCheckStateMachineArn: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;

    await populateTable(
      {
        sessionId: input.sessionId,
        expiryDate: 9999999999,
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

  it("should fail when there is more than 2 nino check attempts", async () => {
    await executeStepFunction(input, output.NinoCheckStateMachineArn);
    await executeStepFunction(input, output.NinoCheckStateMachineArn);
    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );
    expect(startExecutionResult.output).toBe(
      '{"error":"Maximum number of attempts exceeded"}'
    );
  });

  it("should fail when there is no user present for given nino", async () => {
    await clearItems(personIdentityTableName, {
      sessionId: input.sessionId,
    });
    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );
    expect(startExecutionResult.output).toBe(
      '{"error":"No user found for given nino"}'
    );
  });

  it("should fail when there is no user in HMRC present", async () => {
    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );
    expect(startExecutionResult.output).toBe(
      '{"error":"CID returned no record"}'
    );
  });
});
