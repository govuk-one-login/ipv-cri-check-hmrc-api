import { stackOutputs } from "../resources/cloudformation-helper";
import { clearItems, populateTable } from "../resources/dynamodb-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";

describe("Nino Check", () => {
  const sessionId = "12345";
  const nino = "AA000003D";
  const badNino = "abc";
  const testUser = {
    nino: nino,
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

  describe("Unhappy User Input Paths", () => {
    it("should fail when there is no sessionId present", async () => {
      const startExecutionResult = await executeStepFunction(
        {
          nino: nino,
        },
        output.NinoCheckStateMachineArn
      );
      expect(startExecutionResult.output).toBe('{"nino":"AA000003D"}');
    });

    it("should fail when there is no nino present", async () => {
      const startExecutionResult = await executeStepFunction(
        {
          sessionId: sessionId,
        },
        output.NinoCheckStateMachineArn
      );
      expect(startExecutionResult.output).toBe('{"sessionId":"12345"}');
    });

    describe("Unhappy Nino Check Paths", () => {
      it("should fail when there is more than 2 nino check attempts", async () => {
        await executeStepFunction(
          {
            sessionId: sessionId,
            nino: badNino,
          },
          output.NinoCheckStateMachineArn
        );
        await executeStepFunction(
          {
            sessionId: sessionId,
            nino: badNino,
          },
          output.NinoCheckStateMachineArn
        );
        const startExecutionResult = await executeStepFunction(
          {
            sessionId: sessionId,
            nino: badNino,
          },
          output.NinoCheckStateMachineArn
        );
        expect(startExecutionResult.output).toBe(
          '{"sessionId":"12345","nino":"abc","check-attempts-exist":{"Count":1,"Items":[{"id":{"S":"12345"},"attempts":{"N":"2"}}],"ScannedCount":1}}'
        );
      });

      it("should fail when there is no user present for given nino", async () => {
        const startExecutionResult = await executeStepFunction(
          {
            sessionId: sessionId,
            nino: badNino,
          },
          output.NinoCheckStateMachineArn
        );
        expect(startExecutionResult.output).toBe(
          '{"sessionId":"12345","nino":"abc","check-attempts-exist":{"Count":0,"Items":[],"ScannedCount":0},"userDetails":{"Count":0,"Items":[],"ScannedCount":0}}'
        );
      });

      it("should fail when there is no user in HMRC present", async () => {
        const goodBadNino = "bad-good-nino";
        await populateTable(
          {
            nino: goodBadNino,
            dob: testUser.dob,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
          },
          output.NinoUsersTable
        );
        const startExecutionResult = await executeStepFunction(
          {
            sessionId: sessionId,
            nino: "bad-good-nino",
          },
          output.NinoCheckStateMachineArn
        );
        await clearItems(output.NinoUsersTable as string, {
          nino: goodBadNino,
        });
        expect(startExecutionResult.output).toBeUndefined();
      });
    });
  });
});
