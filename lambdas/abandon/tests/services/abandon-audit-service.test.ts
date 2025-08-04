jest.mock("../../../common/src/util/audit");

import { sendAbandonedAuditEvent } from "../../src/services/abandon-audit-service";
import { sendAuditEvent } from "../../../common/src/util/audit";
import { AbandonHandlerConfig } from "../../src/config/abandon-handler-config";
import { SessionItem } from "../../../common/src/database/types/session-item";

describe("abandon-audit-service", () => {
  const mockConfig = {
    eventBusName: "test-bus",
    eventBusSource: "test-source",
    issuer: "test-issuer",
  } as AbandonHandlerConfig;

  const mockSession = {
    sessionId: "session-123",
    clientSessionId: "client-123",
    clientIpAddress: "192.0.0.1",
    subject: "user-123",
    persistentSessionId: "persistent-123",
  } as SessionItem;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendAbandonedAuditEvent", () => {
    it("delegates to common sendAuditEvent with correct parameters", async () => {
      await sendAbandonedAuditEvent(mockConfig, mockSession, "device-info");

      expect(sendAuditEvent).toHaveBeenCalledWith("ABANDONED", {
        auditConfig: {
          eventBus: "test-bus",
          source: "test-source",
          issuer: "test-issuer",
        },
        session: mockSession,
        deviceInformation: "device-info",
      });
    });

    it("delegates to common sendAuditEvent without device information", async () => {
      await sendAbandonedAuditEvent(mockConfig, mockSession);

      expect(sendAuditEvent).toHaveBeenCalledWith("ABANDONED", {
        auditConfig: {
          eventBus: "test-bus",
          source: "test-source",
          issuer: "test-issuer",
        },
        session: mockSession,
        deviceInformation: undefined,
      });
    });
  });
});
