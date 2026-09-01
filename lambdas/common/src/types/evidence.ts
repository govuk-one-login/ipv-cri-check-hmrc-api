import { ContraIndicator } from "../../../issue-credential/src/vc/contraIndicator/types";

export const CHECK_METHOD = "data" as const;
export const EVIDENCE_TYPE = "IdentityCheck" as const;

export const STRENGTH_SCORE = 2;

export type CheckDetail = {
  checkMethod: typeof CHECK_METHOD;
};

export const CHECK_DETAIL: CheckDetail = {
  checkMethod: CHECK_METHOD,
};

export type Evidence = {
  checkDetails?: CheckDetail[];
  failedCheckDetails?: CheckDetail[];
  strengthScore?: number;
  validityScore?: number;
  ci?: string[];
  txn: string;
  type: typeof EVIDENCE_TYPE;
  ciReasons?: ContraIndicator[];
  attemptNum?: number;
};

export type AuditEvidence = Evidence & {
  attemptNum: number;
  ciReasons?: ContraIndicator[];
};
