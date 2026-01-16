import {
  AuditEvidence,
  CheckDetail,
  Evidence,
  EVIDENCE_TYPE,
  STRENGTH_SCORE,
} from "../../../common/src/types/evidence";
import { ContraIndicator } from "../vc/contraIndicator/ci-mapping-util";
import { SessionItem } from "@govuk-one-login/cri-types";
import { CiReasonsMapping } from "../vc/contraIndicator/types/ci-reasons-mapping";
import { AttemptsResult } from "../../../common/src/types/attempt";
import { captureMetric } from "../../../common/src/util/metrics";

export const getEvidence = (
  session: Partial<SessionItem>,
  attempts: AttemptsResult,
  checkDetail: CheckDetail,
  contraIndicators: ContraIndicator[]
): Evidence => {
  const strengthScore = session.evidenceRequest?.strengthScore ?? STRENGTH_SCORE;

  let validityScore = strengthScore;
  let checkDetailsKey: keyof Evidence = "checkDetails";
  let ciObj: Pick<Evidence, "ci"> | undefined;

  if (hasUserFailedCheck(attempts)) {
    validityScore = 0;
    checkDetailsKey = "failedCheckDetails";

    const validContraIndicators = contraIndicators.filter(isValidContraIndicator);
    ciObj = { ci: [...new Set(validContraIndicators.map((item) => item.ci))] };

    captureMetric("CIRaisedMetric");
  }

  // PACT expects the evidence to be in this order
  return {
    type: EVIDENCE_TYPE,
    strengthScore,
    validityScore,
    [checkDetailsKey]: [checkDetail],
    ...ciObj,
    txn: session.txn as string,
  };
};

export const getAuditEvidence = (
  attempts: AttemptsResult,
  contraIndicators: ContraIndicator[],
  vcEvidence: Evidence
): AuditEvidence => {
  let attemptNum: number;
  let ciReasons: ContraIndicator[] | undefined;
  if (vcEvidence.ci?.length) {
    const validContraIndicators = contraIndicators.filter(isValidContraIndicator);
    ciReasons = [
      ...new Map(
        validContraIndicators.map((item) => [`${item.ci}@${item.reason}`, { ci: item.ci, reason: item.reason }])
      ).values(),
    ];
    attemptNum = attempts.items.filter((i) => i.attempt === "FAIL").length;
  } else {
    attemptNum = attempts.items.filter((i) => i.attempt === "PASS").length;
  }

  return { ...vcEvidence, attemptNum, ciReasons };
};

const isValidContraIndicator = (item: ContraIndicator): item is CiReasonsMapping =>
  typeof item.ci === "string" && typeof item.reason === "string";

const hasUserFailedCheck = (attempts: AttemptsResult) => attempts.items.filter((i) => i.attempt === "FAIL").length >= 2;
