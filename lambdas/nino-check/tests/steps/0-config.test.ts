import { getConfig } from "../../src/steps/0-config";
import { NinoCheckConfig } from "../../src/types/input";
import { validHmrcConfig } from "./mockConfig";

const originalProcessEnv = JSON.parse(JSON.stringify(process.env));

const validEnvVars = {
  HMRC_OTG_API_URL: validHmrcConfig.otg.apiUrl,
  HMRC_PDV_API_URL: validHmrcConfig.pdv.apiUrl,
  HMRC_PDV_USER_AGENT: validHmrcConfig.pdv.userAgent,
  SESSION_TABLE_SUFFIX: "session-table",
  PERSON_IDENTITY_TABLE_SUFFIX: "person-identity-table",
  ATTEMPT_TABLE_SUFFIX: "attempt-table",
  NINO_USER_TABLE_SUFFIX: "nino-user-table",
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
    const config = getConfig("epic-client-id");

    expect(config).toEqual<NinoCheckConfig>({
      hmrcApiConfig: validHmrcConfig,
      tableNames: {
        sessionTable: "epic-client-id-session-table",
        personIdentityTable: "epic-client-id-person-identity-table",
        attemptTable: "epic-client-id-attempt-table",
        ninoUserTable: "epic-client-id-nino-user-table",
      },
    });
  });

  it("throws an error for a falsy config value", () => {
    process.env.NINO_USER_TABLE_SUFFIX = "";
    expect(() => getConfig("epic-client-id")).toThrow("NINO_USER_TABLE_SUFFIX");
  });
});
