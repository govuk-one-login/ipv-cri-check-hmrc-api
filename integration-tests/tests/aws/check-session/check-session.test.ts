import { stackOutputs } from "../resources/cloudformation-helper";
import { clearItems, populateTable } from "../resources/dynamodb-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";

describe("check-session", () => {
  const input = {
    sessionId: "123456789",
  };

  let output: Partial<{
    CommonStackName: string;
    CheckSessionStateMachineArn: string;
  }>;

  let sessionTableName: string;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
  });

  afterEach(async () => {
    await clearItems(sessionTableName, {
      sessionId: input.sessionId,
    });
  });

  it("should return SESSION_OK when session has not expired", async () => {
    await populateTable(sessionTableName, {
      sessionId: input.sessionId,
      expiryDate: 9999999999,
    });

    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"status":"SESSION_OK"}');
  });

  it("should return SESSION_NOT_FOUND when sessionId does not exist", async () => {
    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"status":"SESSION_NOT_FOUND"}');
  });

  it("should return SESSION_EXPIRED when session has expired", async () => {
    await populateTable(sessionTableName, {
      sessionId: input.sessionId,
      expiryDate: 0,
    });

    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"status":"SESSION_EXPIRED"}');
  });

  it("should return SESSION_NOT_PROVIDED when sessionId is missing", async () => {
    const startExecutionResult = await executeStepFunction(
      output.CheckSessionStateMachineArn as string
    );

    expect(startExecutionResult.output).toBe(
      '{"status":"SESSION_NOT_PROVIDED"}'
    );
  });
});
