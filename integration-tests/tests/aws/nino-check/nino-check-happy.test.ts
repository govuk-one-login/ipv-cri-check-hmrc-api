import { describeStack, StackInfo } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearItemsFromTables,
  populateTables,
} from "../resources/dynamodb-helper";
import { input as stubInput, user as testUser } from "../resources/session-helper";

jest.setTimeout(30_000);

const input = stubInput();
const user = testUser(input);
let stack: StackInfo;

beforeAll(async () => {
  stack = await describeStack();
});

beforeEach(async () => {
  await populateTables(
    {
      tableName: stack.sessionTableName,
      items: {
        sessionId: input.sessionId,
        expiryDate: 9999999999,
      },
    },
    {
      tableName: stack.personIdentityTableName,
      items: {
        sessionId: input.sessionId,
        nino: input.nino,
        birthDates: [{ value: user.dob }],
        names: [
          {
            nameParts: [
              {
                type: "GivenName",
                value: user.firstName,
              },
              {
                type: "FamilyName",
                value: user.lastName,
              },
            ],
          },
        ],
      },
    }
  );
});

afterEach(async () => {
  await clearItemsFromTables(
    {
      tableName: stack.sessionTableName,
      items: { sessionId: input.sessionId },
    },
    {
      tableName: stack.personIdentityTableName,
      items: { sessionId: input.sessionId },
    },
    {
      tableName: stack.outputs.NinoUsersTable as string,
      items: { sessionId: input.sessionId },
    },
    {
      tableName: stack.outputs.NinoAttemptsTable as string,
      items: { id: input.sessionId },
    }
  );
});

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
