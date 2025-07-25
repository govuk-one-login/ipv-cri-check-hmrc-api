jest.mock("../../../common/src/util/audit");

import { mockDeviceInformationHeader } from "../mocks/mockConfig";
import { mockNino, mockPersonIdentity, mockSession, mockTxn } from "../../../common/tests/mocks/mockData";
import { sendRequestSentEvent, sendResponseReceivedEvent } from "../../src/helpers/audit";
import { sendAuditEvent } from "../../../common/src/util/audit";
import { REQUEST_SENT, RESPONSE_RECEIVED } from "../../../common/src/types/audit";
import { mockAuditConfig } from "../../../common/tests/mocks/mockConfig";

describe("sendRequestSentEvent()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delegates to common sendAuditEvent with correct parameters", async () => {
    await sendRequestSentEvent(mockAuditConfig, mockSession, mockPersonIdentity, mockNino, mockDeviceInformationHeader);

    expect(sendAuditEvent).toHaveBeenCalledWith(REQUEST_SENT, {
      auditConfig: mockAuditConfig,
      session: mockSession,
      personIdentity: mockPersonIdentity,
      nino: mockNino,
      deviceInformation: mockDeviceInformationHeader,
    });
  });

  it("delegates to common sendAuditEvent without device information", async () => {
    await sendRequestSentEvent(mockAuditConfig, mockSession, mockPersonIdentity, mockNino);

    expect(sendAuditEvent).toHaveBeenCalledWith(REQUEST_SENT, {
      auditConfig: mockAuditConfig,
      session: mockSession,
      personIdentity: mockPersonIdentity,
      nino: mockNino,
    });
  });
});

describe("sendResponseReceivedEvent()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to common sendAuditEvent with correct parameters", async () => {
    await sendResponseReceivedEvent(mockAuditConfig, mockSession, mockTxn, mockDeviceInformationHeader);

    expect(sendAuditEvent).toHaveBeenCalledWith(RESPONSE_RECEIVED, {
      auditConfig: mockAuditConfig,
      session: mockSession,
      deviceInformation: mockDeviceInformationHeader,
      evidence: { txn: mockTxn },
    });
  });

  it("delegates to common sendAuditEvent without device information", async () => {
    await sendResponseReceivedEvent(mockAuditConfig, mockSession, mockTxn);

    expect(sendAuditEvent).toHaveBeenCalledWith(RESPONSE_RECEIVED, {
      auditConfig: mockAuditConfig,
      session: mockSession,
      evidence: { txn: mockTxn },
    });
  });
});
