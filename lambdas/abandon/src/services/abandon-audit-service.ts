import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { AbandonHandlerConfig } from "../config/abandon-handler-config";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { logger } from "../../../common/src/util/logger";

const eventBridgeClient = new EventBridgeClient({ region: "eu-west-2" });

export function createUserAuditInfo(sessionItem: SessionItem) {
  const userAuditInfo: Record<string, string> = {
    govuk_signin_journey_id: sessionItem.clientSessionId,
    ip_address: sessionItem.clientIpAddress,
    session_id: sessionItem.sessionId,
    user_id: sessionItem.subject,
  };
  if (sessionItem.persistentSessionId) {
    userAuditInfo.persistent_session_id = sessionItem.persistentSessionId;
  }
  return userAuditInfo;
}

export async function sendAuditEvent(config: AbandonHandlerConfig, userAuditInfo: any, txmaAuditHeader?: string) {
  logger.info("Sending ABANDONED audit event ...");
  const response = await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Detail: JSON.stringify({
            auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
            user: userAuditInfo,
            deviceInformation: txmaAuditHeader,
            issuer: config.issuer,
          }),
          DetailType: "ABANDONED",
          EventBusName: config.eventBusName,
          Source: config.eventBusSource,
        },
      ],
    })
  );
  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    logger.error("Failed to send ABANDONED audit event: EventBridge Response included failed entries");
  } else {
    logger.info("ABANDONED audit event sent successfully");
  }
}
