import { AbandonHandlerConfig } from "../../src/config/abandon-handler-config";

describe("abandon-handler-config", () => {
  beforeEach(() => {
    delete process.env.SESSION_TABLE_NAME;
    delete process.env.ISSUER;
    delete process.env.EVENT_BUS_NAME;
    delete process.env.EVENT_BUS_SOURCE;
  });

  it("should successfully create the abandon handler config", async () => {
    process.env.SESSION_TABLE_NAME = "session-table";
    process.env.ISSUER = "issuer";
    process.env.EVENT_BUS_NAME = "bus-name";
    process.env.EVENT_BUS_SOURCE = "bus-source";

    const config = new AbandonHandlerConfig();

    expect(config.sessionTableName).toBe("session-table");
    expect(config.issuer).toBe("issuer");
    expect(config.eventBusName).toBe("bus-name");
    expect(config.eventBusSource).toBe("bus-source");
  });

  it("should throw an error if SESSION_TABLE_NAME is undefined", async () => {
    process.env.ISSUER = "issuer";
    process.env.EVENT_BUS_NAME = "bus-name";
    process.env.EVENT_BUS_SOURCE = "bus-source";

    expect(() => {
      new AbandonHandlerConfig();
    }).toThrow("SESSION_TABLE_NAME environment variable is required");
  });

  it("should throw an error if ISSUER is undefined", async () => {
    process.env.SESSION_TABLE_NAME = "session-table";
    process.env.EVENT_BUS_NAME = "bus-name";
    process.env.EVENT_BUS_SOURCE = "bus-source";

    expect(() => {
      new AbandonHandlerConfig();
    }).toThrow("ISSUER environment variable is required");
  });

  it("should throw an error if EVENT_BUS_NAME is undefined", async () => {
    process.env.SESSION_TABLE_NAME = "session-table";
    process.env.ISSUER = "issuer";
    process.env.EVENT_BUS_SOURCE = "bus-source";

    expect(() => {
      new AbandonHandlerConfig();
    }).toThrow("EVENT_BUS_NAME environment variable is required");
  });

  it("should throw an error if EVENT_BUS_SOURCE is undefined", async () => {
    process.env.SESSION_TABLE_NAME = "session-table";
    process.env.ISSUER = "issuer";
    process.env.EVENT_BUS_NAME = "bus-name";

    expect(() => {
      new AbandonHandlerConfig();
    }).toThrow("EVENT_BUS_SOURCE environment variable is required");
  });
});
