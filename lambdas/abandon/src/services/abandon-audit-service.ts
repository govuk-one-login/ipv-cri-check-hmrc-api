import { AbandonHandlerConfig } from "../config/abandon-handler-config";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { sendAuditEvent } from "../../../common/src/util/audit";
import { ABANDONED } from "../../../common/src/types/audit";

export async function sendAbandonedAuditEvent(
  config: AbandonHandlerConfig,
  sessionItem: SessionItem,
  txmaAuditHeader?: string
) {
  await sendAuditEvent(ABANDONED, {
    auditConfig: {
      eventBus: config.eventBusName,
      source: config.eventBusSource,
      issuer: config.issuer,
    },
    session: sessionItem,
    deviceInformation: txmaAuditHeader,
  });
}
