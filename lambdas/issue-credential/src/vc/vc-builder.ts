import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { NinoUser } from "../../../common/src/types/nino-user";
import { VerifiableIdentityCredential, VC_CONTEXT, VC_TYPE, JwtClass } from "../types/verifiable-credential";
import { CredentialSubject } from "../types/credential-subject";
import { AttemptsResult } from "../../../common/src/types/attempt";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { getEvidence } from "../evidence/evidence-creator";
import { ContraIndicator } from "./contraIndicator/ci-mapping-util";
import { logger } from "../../../common/src/util/logger";
import { CHECK_DETAIL } from "../../../common/src/types/evidence";

/**
 * Builds a Verifiable Credential (VC) need all fields to be in the order
 * specified for PACT tests.
 */
export const buildVerifiableCredential = (
  attempts: AttemptsResult,
  personIdentity: PersonIdentityItem,
  ninoUser: NinoUser,
  session: SessionItem,
  jwtClaims: JwtClass,
  contraIndicators: ContraIndicator[]
): VerifiableIdentityCredential => {
  logger.info("Building verifiable Credential");
  const credentialSubject: CredentialSubject = {
    ...(ninoUser.nino && {
      socialSecurityRecord: [{ personalNumber: ninoUser.nino }],
    }),
    birthDate: personIdentity.birthDates,
    name: personIdentity.names,
  };

  const verifiableCredential = {
    sub: jwtClaims.sub,
    nbf: jwtClaims.nbf,
    iss: jwtClaims.iss,
    exp: jwtClaims.exp,
    vc: {
      evidence: [getEvidence(session, attempts, CHECK_DETAIL, contraIndicators)],
      credentialSubject,
      type: VC_TYPE,
      "@context": VC_CONTEXT,
    },
    jti: jwtClaims.jti,
  };
  logger.info("Verifiable Credential Structure generated successfully.");
  return verifiableCredential;
};
