import { CHECK_METHOD, CheckDetail, DATA_CHECK, Evidence, EVIDENCE_TYPE } from "../../../common/src/types/evidence";
import { ContraIndicator } from "../vc/contraIndicator/ci-mapping-util";
import { EvidenceRequest, SessionItem } from "../../../common/src/database/types/session-item";
import { CiReasonsMapping } from "../vc/contraIndicator/types/ci-reasons-mapping";
import { AttemptsResult } from "../../../common/src/types/attempt";
import { captureMetric } from "../../../common/src/util/metrics";

export const getEvidence = (
  session: Partial<SessionItem>,
  attempts: AttemptsResult,
  checkDetail: CheckDetail,
  contraIndicators: ContraIndicator[]
) => {
  const evidence: Evidence = { txn: session.txn as string, type: EVIDENCE_TYPE };
  if (hasUserFailedCheck(attempts)) {
    evidence.failedCheckDetails = [checkDetail];
  } else {
    evidence.checkDetails = [checkDetail];
  }

  if (session.evidenceRequest) {
    evidence.strengthScore = session.evidenceRequest.strengthScore;
    evidence.validityScore = hasUserFailedCheck(attempts) ? 0 : session.evidenceRequest.strengthScore;

    if (hasUserFailedCheck(attempts)) {
      const validContraIndicators = contraIndicators.filter(isValidContraIndicator);
      evidence.ci = [...new Set(validContraIndicators.map((item) => item.ci))];
      captureMetric("CIRaisedMetric");
    }
  }
  return evidence;
};

export const getAuditEvidence = (
  attempts: AttemptsResult,
  contraIndicators: ContraIndicator[],
  vcEvidence: Evidence
) => {
  if (vcEvidence.ci?.length) {
    const validContraIndicators = contraIndicators.filter(isValidContraIndicator);
    vcEvidence.ciReasons = [
      ...new Map(
        validContraIndicators.map((item) => [`${item.ci}@${item.reason}`, { ci: item.ci, reason: item.reason }])
      ).values(),
    ];
    vcEvidence.attemptNum = attempts.items.filter((i) => i.attempt === "FAIL").length;
    return vcEvidence;
  }
  vcEvidence.attemptNum = attempts.items.filter((i) => i.attempt === "PASS").length;
  return vcEvidence;
};

export const getCheckDetail = (evidenceRequest?: EvidenceRequest): CheckDetail => ({
  checkMethod: CHECK_METHOD,
  ...(!evidenceRequest && { dataCheck: DATA_CHECK }),
});

const isValidContraIndicator = (item: ContraIndicator): item is CiReasonsMapping =>
  typeof item.ci === "string" && typeof item.reason === "string";

const hasUserFailedCheck = (attempts: AttemptsResult) => attempts.items.filter((i) => i.attempt === "FAIL").length >= 2;
