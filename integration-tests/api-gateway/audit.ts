import type { UnixSecondsTimestamp } from "@govuk-one-login/cri-types";
import { Evidence } from "../../lambdas/common/src/types/evidence";
import { AuditEvent, AuditRestricted } from "@govuk-one-login/cri-audit";

const prefix = "IPV_HMRC_RECORD_CHECK_CRI" as const;

export const START_EVENT_NAME = `${prefix}_START`;
export const REQUEST_SENT_EVENT_NAME = `${prefix}_REQUEST_SENT`;
export const RESPONSE_RECEIVED_EVENT_NAME = `${prefix}_RESPONSE_RECEIVED`;
export const VC_ISSUED_EVENT_NAME = `${prefix}_VC_ISSUED`;
export const END_EVENT_NAME = `${prefix}_END`;
export const ABANDONED_EVENT_NAME = `${prefix}_ABANDONED`;

export const TEST_HARNESS_EXECUTE_URL = process.env.TEST_HARNESS_EXECUTE_URL ?? "";

export interface NinoCheckAuditRestricted extends AuditRestricted {
	socialSecurityRecord?: { personalNumber: string }[];
};

export type NinoCheckAuditExtensions = {
  evidence?:
    | (Evidence & { attemptNum: number; ciReasons?: { ci: string; reason: string }[] })[]
    | { txn: string }
    | [{ context: string }];
};

export type AuditEventRecord<EventType = AuditEvent<never, never, AuditRestricted>> = {
  partitionKey: `SESSION#${string}`;
  sortKey: `TXMA#${typeof prefix}_${string}#${string}#${string}`;
  event: EventType;
  expiryDate: UnixSecondsTimestamp;
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function baseExpectedEvent(eventName: string, sessionId: string): AuditEvent {
  return {
    component_id: expect.stringMatching(/^https:\/\/.+\.account\.gov\.uk$/),
    event_name: eventName,
    event_timestamp_ms: expect.any(Number),
    timestamp: expect.any(Number),
    user: expect.objectContaining({
      govuk_signin_journey_id: expect.stringMatching(uuidRegex),
      ip_address: expect.any(String),
      session_id: sessionId,
      user_id: expect.stringMatching(/^urn:fdc:gov\.uk:.+$/),
      // persistent_session_id is optional and seems to be unset for journeys initiated through the core stub
    }),
  };
}
