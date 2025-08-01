import { PersonIdentityDateOfBirth, PersonIdentityNamePart } from "../database/types/person-identity";
import { UnixMillisecondsTimestamp, UnixSecondsTimestamp } from "./brands";
import { Evidence } from "./evidence";

export type AuditConfig = {
  queueUrl: string;
  componentId: string;
};
export const AUDIT_PREFIX = "IPV_HMRC_RECORD_CHECK_CRI" as const;
export const REQUEST_SENT = "REQUEST_SENT" as const;
export const RESPONSE_RECEIVED = "RESPONSE_RECEIVED" as const;
export const VC_ISSUED = "VC_ISSUED" as const;
export const END = "END" as const;
export const ABANDONED = "ABANDONED" as const;
export type AuditEventType =
  | typeof REQUEST_SENT
  | typeof RESPONSE_RECEIVED
  | typeof VC_ISSUED
  | typeof END
  | typeof ABANDONED;

export type AuditUser = {
  govuk_signin_journey_id: string;
  ip_address: string;
  session_id: string;
  user_id: string;
  persistent_session_id?: string;
};

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

export type AuditEvent = {
  client_id?: string;
  component_id: string;
  event_name: string;
  event_timestamp_ms: UnixMillisecondsTimestamp;
  timestamp: UnixSecondsTimestamp;
  user: AuditUser;
  restricted?: AuditRestricted;
  extensions?: AuditExtensions;
};
