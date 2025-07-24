import { CiReasonsMapping } from "../vc/contraIndicator/ci-mappings-validator";

export const CHECK_METHOD = "data" as const;
export const DATA_CHECK = "record_check" as const;
export const EVIDENCE_TYPE = "IdentityCheck" as const;

export type CheckDetail = {
  checkMethod: typeof CHECK_METHOD;
  dataCheck?: typeof DATA_CHECK;
};

export type Evidence = {
  checkDetails?: CheckDetail[];
  failedCheckDetails?: CheckDetail[];
  strengthScore?: number;
  validityScore?: number;
  ci?: string[];
  txn: string;
  type: typeof EVIDENCE_TYPE;
  ciReasons?: CiReasonsMapping[];
  attemptNum?: number;
};
