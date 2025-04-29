import { JWTPayload } from "jose";
export type JWTClaimsSet = {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  nbf: number;
  jti: string;
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  govuk_signin_journey_id: string;
  shared_claims?: undefined;
  evidence_requested?: undefined;
  context?: string;
};
export type PrivateSigningKey = {
  kty: string;
  d: string;
  use: string;
  crv: string;
  kid: string;
  x: string;
  y: string;
  alg: string;
};

export type Payload = {
  clientId: string;
  audience: string;
  authorizationEndpoint: string;
  redirectUrl: string;
  publicEncryptionKeyBase64: string;
  privateSigningKey: PrivateSigningKey;
  issuer: string;
  claimSet: JWTPayload;
};
