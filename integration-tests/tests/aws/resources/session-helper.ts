import { clearItemsFromTables } from "./dynamodb-helper";
import { StackInfo } from "./cloudformation-helper";

type Input = ReturnType<typeof input>;

export const input = (nino?: string) => ({
  sessionId: "123456789",
  nino: nino || "AA000003D",
});

export const user = (stateMachineInput = input()) => ({
  nino: stateMachineInput.nino,
  dob: "1948-04-23",
  firstName: "Jim",
  lastName: "Ferguson",
});

export const isValidTimestamp = (timestamp: number) =>
  !isNaN(new Date(timestamp).getTime());

export const clearSession = (stack: StackInfo, input: Input) =>
  clearItemsFromTables(
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

export const sessionData = (stack: StackInfo, input: Input) => ({
  tableName: stack.sessionTableName,
  items: {
    sessionId: input.sessionId,
    expiryDate: 9999999999,
  },
});

export const personIdentityData = (
  stack: StackInfo,
  input: Input,
  testUser = user(input)
) => ({
  tableName: stack.personIdentityTableName,
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
});
