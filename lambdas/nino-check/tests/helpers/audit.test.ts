const mockEventBridgeClient = {
  send: jest.fn(),
};
const mockPutEventsCommand = jest.fn().mockImplementation((input: PutEventsCommandInput) => ({ op: "put", input }));
jest.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => mockEventBridgeClient),
  PutEventsCommand: mockPutEventsCommand,
}));

import { PutEventsCommandInput } from "@aws-sdk/client-eventbridge";
import { mockAuditConfig, mockDeviceInformationHeader } from "../mocks/mockConfig";
import { mockNino, mockPersonIdentity, mockSession, mockTxn } from "../mocks/mockData";
import { sendRequestSentEvent, sendResponseReceivedEvent } from "../../src/helpers/audit";
import { marshall } from "@aws-sdk/util-dynamodb";

describe("sendRequestSentEvent()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the event correctly given valid input", async () => {
    await sendRequestSentEvent(mockAuditConfig, mockSession, mockPersonIdentity, mockNino, mockDeviceInformationHeader);

    expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
      new mockPutEventsCommand({
        Entries: [
          {
            DetailType: "REQUEST_SENT",
            EventBusName: mockAuditConfig.eventBus,
            Source: mockAuditConfig.source,
            Detail: JSON.stringify({
              auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
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
    await sendRequestSentEvent(mockAuditConfig, mockSession, mockPersonIdentity, mockNino);

    expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
      new mockPutEventsCommand({
        Entries: [
          {
            DetailType: "REQUEST_SENT",
            EventBusName: mockAuditConfig.eventBus,
            Source: mockAuditConfig.source,
            Detail: JSON.stringify({
              auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
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

describe("sendResponseReceivedEvent()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the event correctly given valid input", async () => {
    await sendResponseReceivedEvent(mockAuditConfig, mockSession, mockTxn, mockDeviceInformationHeader);

    expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
      new mockPutEventsCommand({
        Entries: [
          {
            DetailType: "RESPONSE_RECEIVED",
            EventBusName: mockAuditConfig.eventBus,
            Source: mockAuditConfig.source,
            Detail: JSON.stringify({
              auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
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
    await sendResponseReceivedEvent(mockAuditConfig, mockSession, mockTxn);

    expect(mockEventBridgeClient.send).toHaveBeenCalledWith(
      new mockPutEventsCommand({
        Entries: [
          {
            DetailType: "RESPONSE_RECEIVED",
            EventBusName: mockAuditConfig.eventBus,
            Source: mockAuditConfig.source,
            Detail: JSON.stringify({
              auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
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
