const mockEventBridgeClient = {
  send: jest.fn(),
};
const mockPutEventsCommand = jest.fn().mockImplementation((input: PutEventsCommandInput) => ({ op: "put", input }));
jest.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => mockEventBridgeClient),
  PutEventsCommand: mockPutEventsCommand,
}));

import { PutEventsCommandInput } from "@aws-sdk/client-eventbridge";
import { mockDeviceInformationHeader } from "../../../nino-check/tests/mocks/mockConfig";
import { mockNino, mockPersonIdentity, mockSession, mockTxn } from "../mocks/mockData";
import { marshall } from "@aws-sdk/util-dynamodb";
import { mockAuditConfig } from "../mocks/mockConfig";
import { AUDIT_PREFIX, REQUEST_SENT, RESPONSE_RECEIVED } from "../../src/types/audit";
import { sendAuditEvent } from "../../src/util/audit";
import { Evidence } from "../../src/types/evidence";
describe("sendAuditEvent()", () => {
  describe("using as sendRequestSentEvent()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("sends the event correctly given valid input", async () => {
      await sendAuditEvent(REQUEST_SENT, {
        auditConfig: mockAuditConfig,
        session: mockSession,
        personIdentity: mockPersonIdentity,
        nino: mockNino,
        deviceInformation: mockDeviceInformationHeader,
      });

      expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
        new mockPutEventsCommand({
          Entries: [
            {
              DetailType: REQUEST_SENT,
              EventBusName: mockAuditConfig.eventBus,
              Source: mockAuditConfig.source,
              Detail: JSON.stringify({
                auditPrefix: AUDIT_PREFIX,
                user: {
                  govuk_signin_journey_id: mockSession.clientSessionId,
                  ip_address: mockSession.clientIpAddress,
                  session_id: mockSession.sessionId,
                  user_id: mockSession.subject,
                  persistent_session_id: mockSession.persistentSessionId,
                },
                deviceInformation: mockDeviceInformationHeader,
                issuer: mockAuditConfig.issuer,
                nino: mockNino,
                userInfoEvent: { Items: [marshall(mockPersonIdentity)], Count: 1 },
              }),
            },
          ],
        })
      );
    });

    it("handles a missing device information header correctly", async () => {
      await sendAuditEvent(REQUEST_SENT, {
        auditConfig: mockAuditConfig,
        session: mockSession,
        personIdentity: mockPersonIdentity,
        nino: mockNino,
      });

      expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
        new mockPutEventsCommand({
          Entries: [
            {
              DetailType: REQUEST_SENT,
              EventBusName: mockAuditConfig.eventBus,
              Source: mockAuditConfig.source,
              Detail: JSON.stringify({
                auditPrefix: AUDIT_PREFIX,
                user: {
                  govuk_signin_journey_id: mockSession.clientSessionId,
                  ip_address: mockSession.clientIpAddress,
                  session_id: mockSession.sessionId,
                  user_id: mockSession.subject,
                  persistent_session_id: mockSession.persistentSessionId,
                },
                issuer: mockAuditConfig.issuer,
                nino: mockNino,
                userInfoEvent: { Items: [marshall(mockPersonIdentity)], Count: 1 },
              }),
            },
          ],
        })
      );
    });
  });

  describe("using as sendResponseReceivedEvent()", () => {
    beforeEach(() => jest.clearAllMocks());

    it("sends the event correctly given valid input", async () => {
      await sendAuditEvent(RESPONSE_RECEIVED, {
        auditConfig: mockAuditConfig,
        session: mockSession,
        deviceInformation: mockDeviceInformationHeader,
        evidence: { txn: mockTxn } as Evidence,
      });

      expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
        new mockPutEventsCommand({
          Entries: [
            {
              DetailType: RESPONSE_RECEIVED,
              EventBusName: mockAuditConfig.eventBus,
              Source: mockAuditConfig.source,
              Detail: JSON.stringify({
                auditPrefix: AUDIT_PREFIX,
                user: {
                  govuk_signin_journey_id: mockSession.clientSessionId,
                  ip_address: mockSession.clientIpAddress,
                  session_id: mockSession.sessionId,
                  user_id: mockSession.subject,
                  persistent_session_id: mockSession.persistentSessionId,
                },
                deviceInformation: mockDeviceInformationHeader,
                issuer: mockAuditConfig.issuer,
                evidence: [{ txn: mockTxn }],
              }),
            },
          ],
        })
      );
    });

    it("handles a missing device information header correctly", async () => {
      await sendAuditEvent(RESPONSE_RECEIVED, {
        auditConfig: mockAuditConfig,
        session: mockSession,
        evidence: { txn: mockTxn } as Evidence,
      });

      expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
        new mockPutEventsCommand({
          Entries: [
            {
              DetailType: RESPONSE_RECEIVED,
              EventBusName: mockAuditConfig.eventBus,
              Source: mockAuditConfig.source,
              Detail: JSON.stringify({
                auditPrefix: AUDIT_PREFIX,
                user: {
                  govuk_signin_journey_id: mockSession.clientSessionId,
                  ip_address: mockSession.clientIpAddress,
                  session_id: mockSession.sessionId,
                  user_id: mockSession.subject,
                  persistent_session_id: mockSession.persistentSessionId,
                },
                issuer: mockAuditConfig.issuer,
                evidence: [{ txn: mockTxn }],
              }),
            },
          ],
        })
      );
    });
  });
});
