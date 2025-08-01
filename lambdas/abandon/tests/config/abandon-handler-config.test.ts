import { AbandonHandlerConfig } from "../../src/config/abandon-handler-config";

describe("abandon-handler-config", () => {
  beforeEach(() => {
    delete process.env.SESSION_TABLE;
    delete process.env.ISSUER;
    delete process.env.AUDIT_QUEUE_URL;
    delete process.env.AUDIT_COMPONENT_ID;
  });

  it("should successfully create the abandon handler config", async () => {
    process.env.SESSION_TABLE = "session-table";
    process.env.ISSUER = "issuer";
    process.env.AUDIT_QUEUE_URL = "cool-queuez.com";
    process.env.AUDIT_COMPONENT_ID = "https://check-hmrc-time.account.gov.uk";

    const config = new AbandonHandlerConfig();

    expect(config.tableNames.sessionTable).toBe("session-table");
    expect(config.issuer).toBe("issuer");
  });

  it("should throw an error if ISSUER is undefined", async () => {
    process.env.SESSION_TABLE = "session-table";
    process.env.AUDIT_QUEUE_URL = "cool-queuez.com";
    process.env.AUDIT_COMPONENT_ID = "https://check-hmrc-time.account.gov.uk";

    expect(() => {
      new AbandonHandlerConfig();
    }).toThrow("Missing required environment variable at init: ISSUER");
  });
});
