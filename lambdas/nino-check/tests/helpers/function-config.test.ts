import { NinoCheckFunctionConfig } from "../../src/helpers/function-config";

const originalProcessEnv = JSON.parse(JSON.stringify(process.env));

const validEnvVars = {
  SESSION_TABLE: "session-table",
  PERSON_IDENTITY_TABLE: "person-identity-table",
  ATTEMPT_TABLE: "attempt-table",
  NINO_USER_TABLE: "nino-user-table",
  AUDIT_QUEUE_URL: "cool-queuez.com",
  AUDIT_COMPONENT_ID: "https://check-hmrc-time.account.gov.uk",
  PDV_USER_AGENT_PARAM_NAME: "user-agent-param",
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
    const config = new NinoCheckFunctionConfig();

    expect(config).toEqual({
      audit: {
        queueUrl: "cool-queuez.com",
        componentId: "https://check-hmrc-time.account.gov.uk",
      },
    });
    expect(config.tableNames).toEqual({
      sessionTable: "session-table",
      personIdentityTable: "person-identity-table",
      attemptTable: "attempt-table",
      ninoUserTable: "nino-user-table",
    });
  });

  it("throws an error for a missing config value", () => {
    process.env.NINO_USER_TABLE = "";
    expect(() => new NinoCheckFunctionConfig()).toThrow("NINO_USER_TABLE");
  });
});
