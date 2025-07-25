import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { PersonIdentityItem } from "../database/types/person-identity";
import { marshall } from "@aws-sdk/util-dynamodb";
import { AuditConfig } from "../config/base-function-config";
import { SessionItem } from "../database/types/session-item";
import { AUDIT_PREFIX, AUDIT_EVENT_TYPE } from "../types/audit";
import { Evidence } from "../types/evidence";
import { logger } from "./logger";

export type AuditUser = {
  govuk_signin_journey_id: string;
  ip_address: string;
  session_id: string;
  user_id: string;
  persistent_session_id?: string;
};

const eventsClient = new EventBridgeClient();

function buildAuditUser(session: SessionItem): AuditUser {
  return {
    govuk_signin_journey_id: session.clientSessionId,
    ip_address: session.clientIpAddress,
    session_id: session.sessionId,
    user_id: session.subject,
    persistent_session_id: session.persistentSessionId,
  };
}
export async function sendAuditEvent(
  eventType: AUDIT_EVENT_TYPE,
  payload: {
    auditConfig: AuditConfig;
    session: SessionItem;
    personIdentity?: PersonIdentityItem;
    nino?: string;
    deviceInformation?: string;
    evidence?: Evidence;
  }
) {
  const { auditConfig, session, personIdentity, nino, deviceInformation, evidence } = payload;
  const user = buildAuditUser(session);

  logger.info(`Sending ${eventType} audit event ...`);
  const response = await eventsClient.send(
    new PutEventsCommand({
      Entries: [
        {
          DetailType: eventType,
          EventBusName: auditConfig.eventBus,
          Source: auditConfig.source,
          Detail: JSON.stringify({
            auditPrefix: AUDIT_PREFIX,
            user,
            deviceInformation: deviceInformation,
            issuer: auditConfig.issuer,
            nino,
            ...(personIdentity && { userInfoEvent: { Items: [marshall(personIdentity)], Count: 1 } }),
            ...(evidence && { evidence: [evidence] }),
          }),
        },
      ],
    })
  );
  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    logger.error(`Failed to send ${eventType} audit event: EventBridge Response included failed entries`);
  } else {
    logger.info(`${eventType} audit event sent successfully`);
  }
}
