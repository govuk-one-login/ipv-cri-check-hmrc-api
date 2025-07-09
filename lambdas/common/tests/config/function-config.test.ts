import { BaseFunctionConfig } from "../../src/config/base-function-config";

const originalProcessEnv = JSON.parse(JSON.stringify(process.env));

const validEnvVars = {
  SESSION_TABLE: "session-table",
  PERSON_IDENTITY_TABLE: "person-identity-table",
  ATTEMPT_TABLE: "attempt-table",
  NINO_USER_TABLE: "nino-user-table",
  AUDIT_EVENT_BUS: "audit-event-bus",
  AUDIT_SOURCE: "audit-source",
  AUDIT_ISSUER: "audit-issuer",
};

describe("NINo Check function getConfig()", () => {
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
      tableNames: {
        sessionTable: "session-table",
        personIdentityTable: "person-identity-table",
        attemptTable: "attempt-table",
        ninoUserTable: "nino-user-table",
      },
      audit: {
        eventBus: "audit-event-bus",
        source: "audit-source",
        issuer: "audit-issuer",
      },
    });
  });

  it("throws an error for a missing config value", () => {
    process.env.NINO_USER_TABLE = "";
    expect(() => new BaseFunctionConfig()).toThrow("NINO_USER_TABLE");
  });
});
