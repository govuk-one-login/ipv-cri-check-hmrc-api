import { getConfig } from "../../src/steps/0-get-config";
import { NinoCheckFunctionConfig } from "../../src/types/input";
import { mockDeviceInformationHeader } from "./mockConfig";

const originalProcessEnv = JSON.parse(JSON.stringify(process.env));

const validEnvVars = {
  SESSION_TABLE: "session-table",
  PERSON_IDENTITY_TABLE: "person-identity-table",
  ATTEMPT_TABLE: "attempt-table",
  NINO_USER_TABLE: "nino-user-table",
  AUDIT_EVENT_BUS: "audit-event-bus",
  AUDIT_SOURCE: "audit-source",
  AUDIT_ISSUER: "audit-issuer",
  PDV_USER_AGENT_PARAM_NAME: "user-agent-param",
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
    const config = getConfig({
      deviceInformationHeader: mockDeviceInformationHeader,
    });

    expect(config).toEqual<NinoCheckFunctionConfig>({
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
        deviceInformation: mockDeviceInformationHeader,
      },
      hmrcApi: { pdvUserAgentParamName: "user-agent-param" },
    });
  });

  it("throws an error for a missing config value", () => {
    process.env.NINO_USER_TABLE = "";
    expect(() => getConfig({ deviceInformationHeader: mockDeviceInformationHeader })).toThrow("NINO_USER_TABLE");
  });
});
