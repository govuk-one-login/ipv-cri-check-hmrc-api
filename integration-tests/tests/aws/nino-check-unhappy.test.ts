import {
  clearItems,
  populateNinoTable,
} from "./resources/nino-check-dynamodb-helper";
import { executeStepFunction } from "./resources/nino-check-stepfunction-helper";

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

  beforeEach(async () => {
    await populateNinoTable(testUser);
  });

  afterEach(async () => {
    await clearItems(process.env.NINO_USERS_TABLE as string, {
      nino: testUser.nino,
    });
    await clearItems(process.env.NINO_ATTEMPTS_TABLE as string, {
      id: sessionId,
    });
  });

  describe("Unhappy User Input Paths", () => {
    it("should fail when there is no sessionId present", async () => {
      const startExecutionResult = await executeStepFunction({
        nino: nino,
      });
      expect(startExecutionResult.output).toBe('{"nino":"AA000003D"}');
    });

    it("should fail when there is no nino present", async () => {
      const startExecutionResult = await executeStepFunction({
        sessionId: sessionId,
      });
      expect(startExecutionResult.output).toBe('{"sessionId":"12345"}');
    });

    describe("Unhappy Nino Check Paths", () => {
      it("should fail when there is more than 2 nino check attempts", async () => {
        await executeStepFunction({
          sessionId: sessionId,
          nino: badNino,
        });
        await executeStepFunction({
          sessionId: sessionId,
          nino: badNino,
        });
        const startExecutionResult = await executeStepFunction({
          sessionId: sessionId,
          nino: badNino,
        });
        expect(startExecutionResult.output).toBe(
          '{"sessionId":"12345","nino":"abc","check-attempts-exist":{"Count":1,"Items":[{"id":{"S":"12345"},"attempts":{"N":"2"}}],"ScannedCount":1}}'
        );
      });

      it("should fail when there is no user present for given nino", async () => {
        const startExecutionResult = await executeStepFunction({
          sessionId: sessionId,
          nino: badNino,
        });
        expect(startExecutionResult.output).toBe(
          '{"sessionId":"12345","nino":"abc","check-attempts-exist":{"Count":0,"Items":[],"ScannedCount":0},"userDetails":{"Count":0,"Items":[],"ScannedCount":0}}'
        );
      });

      it("should fail when there is no user in HMRC present", async () => {
        const goodBadNino = "bad-good-nino";
        await populateNinoTable({
          nino: goodBadNino,
          dob: testUser.dob,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        });
        const startExecutionResult = await executeStepFunction({
          sessionId: sessionId,
          nino: "bad-good-nino",
        });
        await clearItems(process.env.NINO_USERS_TABLE as string, {
          nino: goodBadNino,
        });
        expect(startExecutionResult.output).toBeUndefined();
      });
    });
  });
});
