export type AuditConfig = {
  eventBus: string;
  source: string;
  issuer: string;
};
export const AUDIT_PREFIX = "IPV_HMRC_RECORD_CHECK_CRI" as const;
export const REQUEST_SENT = "REQUEST_SENT" as const;
export const RESPONSE_RECEIVED = "RESPONSE_RECEIVED" as const;
export const VC_ISSUED = "VC_ISSUED" as const;
export const END = "END" as const;
export type AUDIT_EVENT_TYPE = typeof REQUEST_SENT | typeof RESPONSE_RECEIVED | typeof VC_ISSUED | typeof END;
