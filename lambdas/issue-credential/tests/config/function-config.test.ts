import { IssueCredFunctionConfig } from "../../src/config/function-config";

const originalProcessEnv = { ...process.env };

const validEnvVars = {
  SESSION_TABLE: "session-table",
  PERSON_IDENTITY_TABLE: "person-identity-table",
  ATTEMPT_TABLE: "attempt-table",
  NINO_USER_TABLE: "nino-user-table",
  AUDIT_QUEUE_URL: "cool-queuez.com",
  AUDIT_COMPONENT_ID: "https://check-hmrc-time.account.gov.uk",
  ISSUER: "bob",
  MAX_JWT_TTL: "3600",
  JWT_TTL_UNIT: "seconds",
  COMMON_STACK_NAME: "common-stack",
};

describe("function config", () => {
  describe("Issue Credential function getConfig()", () => {
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
      const config = new IssueCredFunctionConfig();

      expect(config).toEqual({
        audit: {
          queueUrl: "cool-queuez.com",
          componentId: "https://check-hmrc-time.account.gov.uk",
        },
        credentialIssuerEnv: {
          issuer: "bob",
          maxJwtTtl: 3600,
          jwtTtlUnit: "seconds",
          vcSigningKeyId: "key-id-here",
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
      process.env.MAX_JWT_TTL = "";
      expect(() => new IssueCredFunctionConfig()).toThrow("MAX_JWT_TTL");
    });
  });
});
