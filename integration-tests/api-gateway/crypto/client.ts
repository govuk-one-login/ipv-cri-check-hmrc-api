import { importJWK, JWK, JWTHeaderParameters, JWTPayload, SignJWT } from "jose";
import { CLIENT_ASSERTION_TYPE, GRANT_TYPE } from "../env-variables";
export type PrivateKeyType =
  | { privateSigningKey: string | JWK }
  | { privateSigningKeyId: string };
export type BaseParams = {
  issuer?: string;
  customClaims?: JWTPayload;
} & PrivateKeyType;

const signJwtForToken = async (
  jwtPayload: JWTPayload,
  privateSigningKey: JWK,
  jwtHeader: JWTHeaderParameters = { alg: "ES256", typ: "JWT" }
) => {
  return await new SignJWT(jwtPayload)
    .setProtectedHeader(jwtHeader)
    .sign(await importJWK(privateSigningKey as JWK, "ES256"));
};

export const buildPrivateKeyJwtParams = async (
  code: string,
  params: any,
  signingKey: JWK
) => {
  const signedJwt = await signJwtForToken(params, signingKey);

  return new URLSearchParams({
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    code: code,
    grant_type: GRANT_TYPE,
    redirect_uri: params.redirect_uri,
    client_assertion: signedJwt,
  });
};
