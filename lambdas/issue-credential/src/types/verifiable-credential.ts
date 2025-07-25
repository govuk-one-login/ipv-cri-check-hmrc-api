import { CredentialSubject } from "./credential-subject";
import { Evidence } from "../../../common/src/types/evidence";

export const VC_CONTEXT = [
  "https://www.w3.org/2018/credentials/v1",
  "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
] as const;

export const VC_TYPE = ["VerifiableCredential", "IdentityCheckCredential"] as const;

export type VerifiableCredential = {
  "@context": typeof VC_CONTEXT;
  credentialSubject: CredentialSubject;
  type: typeof VC_TYPE;
  evidence?: Evidence[];
};

export type JwtClass = { iss: string; jti: string; nbf: number; exp: number; sub: string };
export type VerifiableIdentityCredential = JwtClass & {
  vc: VerifiableCredential;
};
