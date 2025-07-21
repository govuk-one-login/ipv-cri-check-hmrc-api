import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { NinoUser } from "../../../common/src/types/nino-user";
import { VerifiableIdentityCredential, VC_CONTEXT, VC_TYPE, JwtClass } from "../types/verifiable-credential";
import { NinoIssueSessionItem } from "../../../common/src/types/nino-issue-session-item";
import { CHECK_METHOD, CheckDetail, DATA_CHECK, Evidence, EVIDENCE_TYPE } from "../types/evidence";
import { CredentialSubject } from "../types/credential-subject";
import { AttemptsResult } from "../../../common/src/types/attempt";
import { ContraIndicator } from "./contraIndicator/ci-mapping-util";

export const buildVerifiableCredential = (
  failedAttempts: AttemptsResult,
  personIdentity: Partial<PersonIdentityItem>,
  ninoUser: Partial<NinoUser>,
  session: Partial<NinoIssueSessionItem>,
  jwtClaims: JwtClass,
  funcContraIndicator?: () => ContraIndicator[]
): VerifiableIdentityCredential => {
  const credentialSubject: CredentialSubject = {
    name: personIdentity.names,
    birthDate: personIdentity.birthDates,
    ...(ninoUser.nino && {
      socialSecurityRecord: [{ personalNumber: ninoUser.nino }],
    }),
  };

  const hasUserFailedCheck = failedAttempts.count >= 2;
  const hasDataCheck = !session.evidenceRequest;

  const checkDetail: CheckDetail = { checkMethod: CHECK_METHOD };
  if (hasDataCheck) {
    checkDetail.dataCheck = DATA_CHECK;
  }

  const evidence: Evidence = { txn: session.txn as string, type: EVIDENCE_TYPE };
  if (hasUserFailedCheck) {
    evidence.failedCheckDetails = [checkDetail];
  } else {
    evidence.checkDetails = [checkDetail];
  }

  if (session.evidenceRequest) {
    evidence.strengthScore = session.evidenceRequest.strengthScore;
    evidence.validityScore = hasUserFailedCheck ? 0 : session.evidenceRequest.strengthScore;

    if (hasUserFailedCheck) {
      const contraIndicators = funcContraIndicator?.() || [];
      evidence.ci = [
        ...new Set(contraIndicators.map((item) => item.ci).filter((ci): ci is string => ci !== undefined)),
      ];
    }
  }

  return {
    ...jwtClaims,
    vc: { "@context": VC_CONTEXT, credentialSubject, type: VC_TYPE, evidence: [evidence] },
  };
};
