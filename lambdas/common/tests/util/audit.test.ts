const mockSqsClient = {
  send: jest.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
};
const mockSendMessageCommand = jest
  .fn()
  .mockImplementation((input: SendMessageCommandInput) => ({ op: "send", input }));
jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: jest.fn().mockImplementation(() => mockSqsClient),
  SendMessageCommand: mockSendMessageCommand,
}));

import { mockDeviceInformationHeader } from "../../../nino-check/tests/mocks/mockConfig";
import { mockSession, mockTxn } from "../mocks/mockData";
import { mockAuditConfig } from "../mocks/mockConfig";
import { AUDIT_PREFIX, AuditEvent, AuditUser, REQUEST_SENT } from "../../src/types/audit";
import { sendAuditEvent } from "../../src/util/audit";
import { SendMessageCommand, SendMessageCommandInput } from "@aws-sdk/client-sqs";
import { UnixMillisecondsTimestamp, UnixSecondsTimestamp } from "../../src/types/brands";

Date.now = jest.fn().mockReturnValue(9090909);

const mockAuditUser: AuditUser = {
  govuk_signin_journey_id: mockSession.clientSessionId,
  ip_address: mockSession.clientIpAddress,
  session_id: mockSession.sessionId,
  user_id: mockSession.subject,
  persistent_session_id: mockSession.persistentSessionId,
};

const validBaseEvent: AuditEvent = {
  component_id: mockAuditConfig.componentId,
  event_name: `${AUDIT_PREFIX}_${REQUEST_SENT}`,
  event_timestamp_ms: 9090909 as UnixMillisecondsTimestamp,
  timestamp: 9091 as UnixSecondsTimestamp,
  user: mockAuditUser,
};

describe("sendAuditEvent()", () => {
  describe("using as sendRequestSentEvent()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("sends the event correctly given valid input", async () => {
      const context = {
        restricted: { device_information: { encoded: mockDeviceInformationHeader } },
        extensions: { evidence: { txn: mockTxn } },
      };

      await sendAuditEvent(REQUEST_SENT, mockAuditConfig, mockSession, context);

      expect(mockSqsClient.send).toHaveBeenCalledWith(
        new SendMessageCommand({
          QueueUrl: mockAuditConfig.queueUrl,
          MessageBody: JSON.stringify({
            ...validBaseEvent,
            ...context,
          }),
        })
      );
    });

    it("works correctly when context parameter is unset", async () => {
      await sendAuditEvent(REQUEST_SENT, mockAuditConfig, mockSession);

      expect(mockSqsClient.send).toHaveBeenCalledWith(
        new SendMessageCommand({
          QueueUrl: mockAuditConfig.queueUrl,
          MessageBody: JSON.stringify(validBaseEvent),
        })
      );
    });
  });
});
