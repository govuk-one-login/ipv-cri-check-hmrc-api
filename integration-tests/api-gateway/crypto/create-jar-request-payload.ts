import { JWTPayload } from "jose";

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
