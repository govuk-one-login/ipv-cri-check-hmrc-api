import type { UnixSecondsTimestamp, PersonIdentityDateOfBirth, PersonIdentityNamePart} from "@govuk-one-login/cri-types";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { signedFetch } from "../resources/fetch";
import { pause } from "../resources/util";
import { AuditEvent } from "@govuk-one-login/cri-audit/dist/cjs/types";
import { Evidence } from "../../lambdas/common/src/types/evidence";

const prefix = "IPV_HMRC_RECORD_CHECK_CRI" as const;

export const START_EVENT_NAME = `${prefix}_START`;
export const REQUEST_SENT_EVENT_NAME = `${prefix}_REQUEST_SENT`;
export const RESPONSE_RECEIVED_EVENT_NAME = `${prefix}_RESPONSE_RECEIVED`;
export const VC_ISSUED_EVENT_NAME = `${prefix}_VC_ISSUED`;
export const END_EVENT_NAME = `${prefix}_END`;
export const ABANDONED_EVENT_NAME = `${prefix}_ABANDONED`;

export type AuditRestricted = {
  device_information?: {
    encoded: string;
  };
  birthDate?: PersonIdentityDateOfBirth[];
  name?: {
    description?: string;
    validFrom?: number;
    validUntil?: number;
    nameParts: (PersonIdentityNamePart & { validFrom?: number; validUntil?: number })[];
  }[];
  socialSecurityRecord?: { personalNumber: string }[];
};

export type AuditExtensions = {
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

export async function pollForTestHarnessEvents(eventName: string, sessionId: string) {
  const partitionKeyQuery = `SESSION#${sessionId}`;
  const sortKeyQuery = `TXMA#${eventName}`;

  // encodeURIComponent() needed to escape the '#' characters in the keys
  const url = `${process.env.TEST_HARNESS_EXECUTE_URL}events?partitionKey=${encodeURIComponent(
    partitionKeyQuery
  )}&sortKey=${encodeURIComponent(sortKeyQuery)}`;

  let records: AuditEventRecord[] = [];
  const stopTime = Date.now() + 30 * 1000; // 30 secs

  do {
    const res = await signedFetch(url);

    if (res.ok) {
      const body = await res.json();
      const unmarshalledBody = body.map(unmarshall) as AuditEventRecord<string>[];
      records = unmarshalledBody.map((record) => ({ ...record, event: JSON.parse(record.event) }) as AuditEventRecord);

      if (records.length > 0) return records;
    } else {
      console.log(`Received error response from test harness: ${res.status} ${await res.text()}`);
    }

    await pause(5);
  } while (Date.now() < stopTime);

  return records;
}

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
