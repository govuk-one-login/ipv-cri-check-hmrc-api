import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { AuditConfig } from "../../../common/src/config/base-function-config";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { sendAuditEvent } from "../../../common/src/util/audit";
import { REQUEST_SENT, RESPONSE_RECEIVED } from "../../../common/src/types/audit";
import { Evidence } from "../../../common/src/types/evidence";

export const sendRequestSentEvent = async (
  auditConfig: AuditConfig,
  session: SessionItem,
  personIdentity: PersonIdentityItem,
  nino: string,
  deviceInformation?: string
) => {
  await sendAuditEvent(REQUEST_SENT, {
    auditConfig,
    session,
    personIdentity,
    nino,
    deviceInformation,
  });
};

export const sendResponseReceivedEvent = async (
  auditConfig: AuditConfig,
  session: SessionItem,
  txn: string,
  deviceInformation?: string
) => {
  await sendAuditEvent(RESPONSE_RECEIVED, {
    auditConfig,
    session,
    deviceInformation,
    evidence: { txn } as Evidence,
  });
};
