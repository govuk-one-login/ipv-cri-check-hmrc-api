import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { AuditConfig } from "../../../common/src/config/base-function-config";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { sendAuditEvent } from "../../../common/src/util/audit";
import { REQUEST_SENT, RESPONSE_RECEIVED } from "../../../common/src/types/audit";

export const sendRequestSentEvent = async (
  auditConfig: AuditConfig,
  session: SessionItem,
  personIdentity: PersonIdentityItem,
  nino: string,
  deviceInformation?: string
) => {
  await sendAuditEvent(REQUEST_SENT, auditConfig, session, {
    restricted: {
      birthDate: personIdentity.birthDates,
      name: personIdentity.names,
      socialSecurityRecord: [
        {
          personalNumber: nino,
        },
      ],
      device_information: deviceInformation
        ? {
            encoded: deviceInformation,
          }
        : undefined,
    },
  });
};

export const sendResponseReceivedEvent = async (
  auditConfig: AuditConfig,
  session: SessionItem,
  txn: string,
  deviceInformation?: string
) => {
  await sendAuditEvent(RESPONSE_RECEIVED, auditConfig, session, {
    restricted: {
      device_information: deviceInformation
        ? {
            encoded: deviceInformation,
          }
        : undefined,
    },
    extensions: { evidence: { txn } },
  });
};
