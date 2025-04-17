import {
  clearItems,
  getItemByKey,
  populateTable,
} from "../../../resources/dynamodb-helper";
import { executeStepFunction } from "../../../resources/stepfunction-helper";

describe("Abandon", () => {
  const input = {
    sessionId: "abandon-test",
    "txma-audit-encoded": "test encoded header",
  };

  let sessionTableName: string;

  it("should return a 400 when session does not exist", async () => {
    const startExecutionResult = await executeStepFunction(
      `${process.env.ABANDON_STATE_MACHINE_ARN}`,
      input
    );
    expect(startExecutionResult.output).toBe('{"httpStatus":400}');
  });
  describe("step function execution", () => {
    beforeEach(async () => {
      sessionTableName = `${process.env.SESSION_TABLE}`;

      await populateTable(sessionTableName, {
        sessionId: input.sessionId,
        expiryDate: 9999999999,
        clientId: "exampleClientId",
        authorizationCode: "9999999999",
        authorizationCodeExpiryDate: "9999999999",
        clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
        persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
        clientIpAddress: "00.100.8.20",
        subject: "test",
      });
    });
    afterEach(async () => {
      await clearItems(sessionTableName, {
        sessionId: input.sessionId,
      });
    });
    it("should remove the authorizationCode when session exists", async () => {
      const startExecutionResult = await executeStepFunction(
        `${process.env.ABANDON_STATE_MACHINE_ARN}`,
        input
      );

      const sessionRecord = await getItemByKey(sessionTableName, {
        sessionId: input.sessionId,
      });

      expect(startExecutionResult.output).toBe('{"httpStatus":200}');
      expect(sessionRecord.Item?.authorizationCode).toBeUndefined();
      expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBe(0);
    });
  });
});
