import {
  clearItems,
  populateNinoTable,
} from "./resources/nino-check-dynamodb-helper";
import { executeStepFunction } from "./resources/nino-check-stepfunction-helper";

describe("HMRC Nino Check ", () => {
  const sessionId = "12345";
  const testUser = {
    nino: "AA000003D",
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
  describe("happy Case Scenario", () => {
    it("should succeed when called with no previous attempt", async () => {
      const startExecutionResult = await executeStepFunction({
        nino: "AA000003D",
        sessionId: "12345",
      });

      expect(startExecutionResult.output).toBe(
        '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
      );
    });

    it("should succeed when called after 1 failed previous attempt", async () => {
      const firstExecutionResult = await executeStepFunction({
        nino: "AA000003C",
        sessionId: "12345",
      });
      const secondExecutionResult = await executeStepFunction({
        nino: "AA000003D",
        sessionId: "12345",
      });

      expect(firstExecutionResult.output).toBe(
        '{"nino":"AA000003C","sessionId":"12345","check-attempts-exist":{"Count":0,"Items":[],"ScannedCount":0},"userDetails":{"Count":0,"Items":[],"ScannedCount":0}}'
      );
      expect(secondExecutionResult.output).toBe(
        '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
      );
    });
  });
});
