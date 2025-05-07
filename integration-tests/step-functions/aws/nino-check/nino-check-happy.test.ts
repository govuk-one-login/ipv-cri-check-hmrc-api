import { executeStepFunction } from "../../../resources/stepfunction-helper";
import {
  clearItemsFromTables,
  clearAttemptsTable,
  populateTables,
} from "../../../resources/dynamodb-helper";

jest.setTimeout(30_000);

describe("nino-check-happy", () => {
  const input = {
    sessionId: "check-happy",
    nino: "AA000003D",
    "txma-audit-encoded": "test encoded header",
  };

  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };

  let sessionTableName: string;
  let personIdentityTableName: string;
  let userAttemptsTable: string;
  let ninoUsersTable: string;
  let ninoCheckStateMachineArn: string;

  beforeEach(async () => {
    userAttemptsTable = `${process.env.USERS_ATTEMPTS_TABLE}`;
    ninoUsersTable = `${process.env.NINO_USERS_TABLE}`;
    ninoCheckStateMachineArn = `${process.env.NINO_CHECK_STATE_MACHINE_ARN}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    personIdentityTableName = `${process.env.PERSON_IDENTITY_TABLE}`;

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
        tableName: ninoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );
    await clearAttemptsTable(input.sessionId, userAttemptsTable);
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
        tableName: ninoUsersTable as string,
        items: { sessionId: "check-unhappy" },
      }
    );
    await clearAttemptsTable("check-unhappy", userAttemptsTable);
  });

  describe("Step Function success", () => {
    it("should return 200 Ok on 1st attempt", async () => {
      const result = await fetch(
        "https://p1lwmmvrug.execute-api.eu-west-2.amazonaws.com/localdev/check-function",
        {
          method: "POST",
          body: JSON.stringify({
            nino: input.nino,
          }),
          headers: {
            "session-id": input.sessionId,
          },
        }
      );

      const body = await result.json();

      expect(result.status).toBe(200);

      expect(body).toEqual({
        requestRetry: false,
      });
    });

    it("should return 200 Ok while retrying the 2nd attempt", async () => {
      const inputNoCidNinoUser = {
        sessionId: "check-unhappy",
        nino: "AA000003C",
      };
      const testNoCidNinoUser = {
        nino: "EE123456A",
        dob: "1948-04-23",
        firstName: "Error",
        lastName: "Error",
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

      const first = await fetch(
        "https://p1lwmmvrug.execute-api.eu-west-2.amazonaws.com/localdev/check-function",
        {
          method: "POST",
          body: JSON.stringify({
            nino: inputNoCidNinoUser.nino,
          }),
          headers: {
            "session-id": inputNoCidNinoUser.sessionId,
          },
        }
      );

      const firstExecutionResult = await first.json();

      const second = await fetch(
        "https://p1lwmmvrug.execute-api.eu-west-2.amazonaws.com/localdev/check-function",
        {
          method: "POST",
          body: JSON.stringify({
            nino: input.nino,
          }),
          headers: {
            "session-id": inputNoCidNinoUser.sessionId,
          },
        }
      );

      const secondExecutionResult = await second.json();

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      expect(firstExecutionResult).toEqual({
        requestRetry: true,
      });

      expect(secondExecutionResult).toEqual({
        requestRetry: false,
      });
    });
  });
});
