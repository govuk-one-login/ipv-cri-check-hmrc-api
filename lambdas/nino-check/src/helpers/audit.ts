import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { NinoSessionItem } from "../../../common/src/types/nino-session-item";
import { AuditUser } from "./nino";
import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { marshall } from "@aws-sdk/util-dynamodb";
import { AuditConfig } from "../../../common/src/config/base-function-config";

const eventsClient = new EventBridgeClient();

const auditPrefix = "IPV_HMRC_RECORD_CHECK_CRI";

function buildAuditUser(session: NinoSessionItem): AuditUser {
  return {
    govuk_signin_journey_id: session.clientSessionId,
    ip_address: session.clientIpAddress,
    session_id: session.sessionId,
    user_id: session.subject,
    persistent_session_id: session.persistentSessionId,
  };
}

export async function sendRequestSentEvent(
  auditConfig: AuditConfig,
  session: NinoSessionItem,
  personIdentity: PersonIdentityItem,
  nino: string,
  deviceInformation?: string
) {
  const user = buildAuditUser(session);

  await eventsClient.send(
    new PutEventsCommand({
      Entries: [
        {
          DetailType: "REQUEST_SENT",
          EventBusName: auditConfig.eventBus,
          Source: auditConfig.source,
          Detail: JSON.stringify({
            auditPrefix,
            user,
            deviceInformation: deviceInformation,
            issuer: auditConfig.issuer,
            nino,
            // marshall the person identity for consistency with the step function that came before this Lambda
            userInfoEvent: { Items: [marshall(personIdentity)], Count: 1 },
          }),
        },
      ],
    })
  );
}

export async function sendResponseReceivedEvent(
  auditConfig: AuditConfig,
  session: NinoSessionItem,
  txn: string,
  deviceInformation?: string
) {
  const user = buildAuditUser(session);

  await eventsClient.send(
    new PutEventsCommand({
      Entries: [
        {
          DetailType: "RESPONSE_RECEIVED",
          EventBusName: auditConfig.eventBus,
          Source: auditConfig.source,
          Detail: JSON.stringify({
            auditPrefix,
            user,
            deviceInformation: deviceInformation,
            issuer: auditConfig.issuer,
            evidence: [{ txn }],
          }),
        },
      ],
    })
  );
}
