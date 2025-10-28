import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BaseFunctionConfig } from "../../src/config/base-function-config";

const originalProcessEnv = { ...process.env };

const validEnvVars = {
  SESSION_TABLE: "session-table",
  PERSON_IDENTITY_TABLE: "person-identity-table",
  ATTEMPT_TABLE: "attempt-table",
  NINO_USER_TABLE: "nino-user-table",
  AUDIT_QUEUE_URL: "cool-queuez.com",
  AUDIT_COMPONENT_ID: "https://check-hmrc-time.account.gov.uk",
};

describe("NINo Check function config", () => {
  beforeEach(() => {
    process.env = {
      ...process.env,
      ...validEnvVars,
    };
  });

  afterAll(() => {
    process.env = originalProcessEnv;
  });

  it("returns the right data for a certain input", () => {
    const config = new BaseFunctionConfig();

    expect(config).toEqual({
      audit: {
        queueUrl: "cool-queuez.com",
        componentId: "https://check-hmrc-time.account.gov.uk",
      },
    });
    expect(config.tableNames).toEqual({ sessionTable: "session-table" });
  });

  it("throws an error for a missing config value", () => {
    process.env.SESSION_TABLE = "";
    expect(() => new BaseFunctionConfig()).toThrow("SESSION_TABLE");
  });
});
