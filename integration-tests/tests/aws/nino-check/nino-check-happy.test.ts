import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearItemsFromTables,
  clearAttemptsTable,
  populateTables,
} from "../resources/dynamodb-helper";

jest.setTimeout(30_000);

describe("nino-check-happy", () => {
  const input = {
    sessionId: "check-happy",
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
    UserAttemptsTable: string;
    NinoUsersTable: string;
    NinoCheckStateMachineArn: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;

    await populateTables(
      {
        tableName: sessionTableName,
        items: {
          sessionId: input.sessionId,
          expiryDate: 9999999999,
          clientId: "ipv-core-stub-aws-prod",
          clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
          persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
          subject: "test",
          clientIpAddress: "00.100.8.20",
        },
      },
      {
        tableName: personIdentityTableName,
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
      }
    );
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: output.NinoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );
    await clearAttemptsTable(input.sessionId, output.UserAttemptsTable);
    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId: "check-unhappy" },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: "check-unhappy" },
      },
      {
        tableName: output.NinoUsersTable as string,
        items: { sessionId: "check-unhappy" },
      }
    );
    await clearAttemptsTable("check-unhappy", output.UserAttemptsTable);
  });

  it("should execute nino step function 1st attempt", async () => {
    const startExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"httpStatus":200}');
  });

  it("should execute nino step function 2nd attempt", async () => {
    const inputNoCidNinoUser = {
      sessionId: "check-unhappy",
      nino: "AA000003C",
    };
    const testNoCidNinoUser = {
      nino: inputNoCidNinoUser.nino,
      dob: "1948-04-23",
      firstName: "Error",
      lastName: "NinoDoesNotMatchCID",
    };

    await populateTables(
      {
        tableName: sessionTableName,
        items: {
          sessionId: inputNoCidNinoUser.sessionId,
          expiryDate: 9999999999,
          clientId: "ipv-core-stub-aws-prod",
          clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
          persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
          subject: "test",
          clientIpAddress: "00.100.8.20",
        },
      },
      {
        tableName: personIdentityTableName,
        items: {
          sessionId: inputNoCidNinoUser.sessionId,
          nino: inputNoCidNinoUser.sessionId,
          birthDates: [{ value: testNoCidNinoUser.dob }],
          names: [
            {
              nameParts: [
                {
                  type: "GivenName",
                  value: testNoCidNinoUser.firstName,
                },
                {
                  type: "FamilyName",
                  value: testNoCidNinoUser.lastName,
                },
              ],
            },
          ],
        },
      }
    );

    const firstExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      {
        sessionId: inputNoCidNinoUser.sessionId,
        nino: testNoCidNinoUser.nino,
      }
    );

    const secondExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      input
    );

    expect(firstExecutionResult.output).toBe('{"httpStatus":422}');

    expect(secondExecutionResult.output).toBe('{"httpStatus":200}');
  });
});
