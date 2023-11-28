import { describeStack, StackInfo } from "../resources/cloudformation-helper";
import { populateTable } from "../resources/dynamodb-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import { clearSession, input as stubInput } from "../resources/session-helper";

const input = stubInput();
let stack: StackInfo;

beforeAll(async () => (stack = await describeStack()));
afterEach(async () => clearSession(stack, input));

it("should return SESSION_OK when session has not expired", async () => {
  await populateTable(stack.sessionTableName, {
    sessionId: input.sessionId,
    expiryDate: 9999999999,
  });

  const startExecutionResult = await executeStepFunction(
    stack.outputs.CheckSessionStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe('{"status":"SESSION_OK"}');
});

it("should return SESSION_NOT_FOUND when sessionId does not exist", async () => {
  const startExecutionResult = await executeStepFunction(
    stack.outputs.CheckSessionStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe('{"status":"SESSION_NOT_FOUND"}');
});

it("should return SESSION_EXPIRED when session has expired", async () => {
  await populateTable(stack.sessionTableName, {
    sessionId: input.sessionId,
    expiryDate: 0,
  });

  const startExecutionResult = await executeStepFunction(
    stack.outputs.CheckSessionStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe('{"status":"SESSION_EXPIRED"}');
});

it("should return SESSION_NOT_PROVIDED when sessionId is missing", async () => {
  const startExecutionResult = await executeStepFunction(
    stack.outputs.CheckSessionStateMachineArn as string
  );

  expect(startExecutionResult.output).toBe('{"status":"SESSION_NOT_PROVIDED"}');
});
