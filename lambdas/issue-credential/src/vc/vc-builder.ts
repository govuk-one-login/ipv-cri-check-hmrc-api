import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { NinoUser } from "../../../common/src/types/nino-user";
import { VerifiableIdentityCredential, VC_CONTEXT, VC_TYPE, JwtClass } from "../types/verifiable-credential";
import { CredentialSubject } from "../types/credential-subject";
import { AttemptsResult } from "../../../common/src/types/attempt";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { getCheckDetail, getEvidence } from "../evidence/evidence-creator";
import { ContraIndicator } from "./contraIndicator/ci-mapping-util";

export const buildVerifiableCredential = (
  attempts: AttemptsResult,
  personIdentity: PersonIdentityItem,
  ninoUser: NinoUser,
  session: SessionItem,
  jwtClaims: JwtClass,
  contraIndicators: ContraIndicator[]
): VerifiableIdentityCredential => {
  const credentialSubject: CredentialSubject = {
    name: personIdentity.names,
    birthDate: personIdentity.birthDates,
    ...(ninoUser.nino && {
      socialSecurityRecord: [{ personalNumber: ninoUser.nino }],
    }),
  };

  return {
    ...jwtClaims,
    vc: {
      "@context": VC_CONTEXT,
      credentialSubject,
      type: VC_TYPE,
      evidence: [getEvidence(session, attempts, getCheckDetail(session.evidenceRequest), contraIndicators)],
    },
  };
};
