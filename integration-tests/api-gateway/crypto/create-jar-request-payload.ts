import { JWTPayload } from "jose";
import { buildJarAuthorizationRequest } from "./client";

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

export const getJarAuthorizationPayload = async (payload: Payload) => {
  try {
    return await buildJarAuthorizationRequest(payload);
  } catch (error) {
    console.error("Error building Jar Authorization Request:", error);
    return null;
  }
};
