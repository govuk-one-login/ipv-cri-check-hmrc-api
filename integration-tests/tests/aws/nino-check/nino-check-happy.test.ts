import { stackOutputs } from "../resources/cloudformation-helper";
import { clearItems, populateTable } from "../resources/dynamodb-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";

describe("HMRC Nino Check ", () => {
  const sessionId = "12345";
  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };
  let output: Partial<{
    NinoUsersTable: string;
    NinoAttemptsTable: string;
    NinoCheckStateMachineArn: string;
  }>;
  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    await populateTable(testUser, output.NinoUsersTable);
  });

  afterEach(async () => {
    await clearItems(output.NinoUsersTable as string, {
      nino: testUser.nino,
    });
    await clearItems(output.NinoAttemptsTable as string, {
      id: sessionId,
    });
  });
  describe("Happy Case Nino Check", () => {
    it("should execute nino step function 1st attempt", async () => {
      const startExecutionResult = await executeStepFunction(
        {
          nino: "AA000003D",
          sessionId: "12345",
        },
        output.NinoCheckStateMachineArn
      );
      expect(startExecutionResult.output).toBe(
        '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
      );
    });

    it("should execute nino step function 2nd attempt", async () => {
      const firstExecutionResult = await executeStepFunction(
        {
          nino: "AA000003C",
          sessionId: "12345",
        },
        output.NinoCheckStateMachineArn
      );
      const secondExecutionResult = await executeStepFunction(
        {
          nino: "AA000003D",
          sessionId: "12345",
        },
        output.NinoCheckStateMachineArn
      );

      expect(firstExecutionResult.output).toBe(
        '{"nino":"AA000003C","sessionId":"12345","check-attempts-exist":{"Count":0,"Items":[],"ScannedCount":0},"userDetails":{"Count":0,"Items":[],"ScannedCount":0}}'
      );
      expect(secondExecutionResult.output).toBe(
        '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
      );
    });
  });
});
