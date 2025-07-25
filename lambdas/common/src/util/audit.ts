import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { AuditConfig } from "../config/base-function-config";
import { SessionItem } from "../database/types/session-item";
import { AuditEvent, AuditEventType, AuditUser } from "../types/audit";
import { logger } from "./logger";
import { UnixMillisecondsTimestamp, UnixSecondsTimestamp } from "../types/brands";

const auditClient = new SQSClient();

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
  eventType: AuditEventType,
  auditConfig: AuditConfig,
  session: SessionItem,
  context?: Pick<AuditEvent, "restricted" | "extensions">
) {
  const user = buildAuditUser(session);

  logger.info(`Sending ${eventType} audit event ...`);

  const timestamp = Date.now() as UnixMillisecondsTimestamp;
  const secondsTimestamp = Math.round(timestamp / 1000) as UnixSecondsTimestamp;

  const auditEvent: AuditEvent = {
    client_id: session.clientId,
    component_id: auditConfig.issuer,
    event_name: `${auditConfig.auditEventNamePrefix}_${eventType}`,
    event_timestamp_ms: timestamp,
    timestamp: secondsTimestamp,
    user,
    restricted: context?.restricted,
    extensions: context?.extensions,
  };

  const response = await auditClient.send(
    new SendMessageCommand({
      QueueUrl: auditConfig.queueUrl,
      MessageBody: JSON.stringify(auditEvent),
    })
  );

  logger.info(`Successfully fired ${eventType} event - response code: ${response.$metadata.httpStatusCode ?? -1}`);
}
