import { CHECK_METHOD, CheckDetail, DATA_CHECK, Evidence, EVIDENCE_TYPE } from "../types/evidence";
import { ContraIndicator } from "../vc/contraIndicator/ci-mapping-util";
import { EvidenceRequest, SessionItem } from "../../../common/src/database/types/session-item";
import { CiReasonsMapping } from "../vc/contraIndicator/types/ci-reasons-mapping";
import { AttemptsResult } from "../../../common/src/types/attempt";
import { CiMappings } from "../vc/contraIndicator/types/ci-mappings";
import { getHmrcContraIndicators } from "../vc/contraIndicator";

export const getEvidence = (
  session: Partial<SessionItem>,
  attempts: AttemptsResult,
  checkDetail: CheckDetail,
  ciMappings?: CiMappings
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
      const contraIndicators = ciMappings ? getHmrcContraIndicators(ciMappings) : [];
      const validContraIndicators = contraIndicators.filter(isValidContraIndicator);
      evidence.ci = [...new Set(validContraIndicators.map((item) => item.ci))];
    }
  }
  return evidence;
};

export const getAuditEvidence = (
  session: Partial<SessionItem>,
  attempts: AttemptsResult,
  checkDetail: CheckDetail,
  ciMappings?: CiMappings
) => {
  const evidence: Evidence = getEvidence(session, attempts, checkDetail, ciMappings);
  if (session.evidenceRequest) {
    if (evidence.ci?.length) {
      const contraIndicators = ciMappings ? getHmrcContraIndicators(ciMappings) : [];
      const validContraIndicators = contraIndicators.filter(isValidContraIndicator);
      evidence.ciReasons = [
        ...new Map(
          validContraIndicators.map((item) => [`${item.ci}@${item.reason}`, { ci: item.ci, reason: item.reason }])
        ).values(),
      ];
      evidence.attemptNum = attempts.failedCount;
      return evidence;
    }
    evidence.attemptNum = attempts.successCount;
  }
  return evidence;
};

export const getCheckDetail = (evidenceRequest?: EvidenceRequest): CheckDetail => ({
  checkMethod: CHECK_METHOD,
  ...(!evidenceRequest && { dataCheck: DATA_CHECK }),
});

const isValidContraIndicator = (item: ContraIndicator): item is CiReasonsMapping =>
  typeof item.ci === "string" && typeof item.reason === "string";

const hasUserFailedCheck = (attempts: AttemptsResult) => (attempts?.failedItems?.length || 0) >= 2;
