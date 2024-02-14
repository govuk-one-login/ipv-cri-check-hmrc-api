import { AuditEventHandler } from "../src/audit-event-handler";
import { Context } from "aws-lambda";

describe("audit-event-handler", () => {
  it("should print Hello, World!", async () => {
    const auditEventHandler = new AuditEventHandler();
    const result = await auditEventHandler.handler({}, {} as Context);
    expect(result).toStrictEqual("Hello, World!");
  });
});
