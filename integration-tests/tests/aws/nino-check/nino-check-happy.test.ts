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
    await clearItems("pdv-matching-nino-attempts", {
      id: input.sessionId,
    });
    await clearItems("pdv-matching-nino-users", {
      sessionId: input.sessionId,
    });
  });

  it("should execute nino step function 1st attempt", async () => {
    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );
    expect(startExecutionResult.output).toBe("{}");
  });

  it("should execute nino step function 2nd attempt", async () => {
    const firstExecutionResult = await executeStepFunction(
      {
        sessionId: input.sessionId,
        nino: "AB123003C",
      },
      output.NinoCheckStateMachineArn
    );

    const secondExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );

    expect(firstExecutionResult.output).toBe(
      '{"error":"CID returned no record"}'
    );
    expect(secondExecutionResult.output).toBe("{}");
  });
});
