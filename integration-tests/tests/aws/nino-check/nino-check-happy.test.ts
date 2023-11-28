import { describeStack, StackInfo } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import { populateTables } from "../resources/dynamodb-helper";
import {
  clearSession,
  input as stubInput,
  personIdentityData,
  sessionData,
} from "../resources/session-helper";

const input = stubInput();
let stack: StackInfo;

beforeAll(async () => (stack = await describeStack()));

beforeEach(async () => {
  await populateTables(
    personIdentityData(stack, input),
    sessionData(stack, input)
  );
});

afterEach(async () => await clearSession(stack, input));

it("should execute nino step function 1st attempt", async () => {
  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe("{}");
});

it("should execute nino step function 2nd attempt", async () => {
  const firstExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    {
      sessionId: input.sessionId,
      nino: "AB123003C",
    }
  );

  const secondExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    input
  );

  expect(firstExecutionResult.output).toBe(
    '{"error":"CID returned no record"}'
  );

  expect(secondExecutionResult.output).toBe("{}");
});
