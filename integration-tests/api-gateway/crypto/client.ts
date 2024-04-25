import { CompactEncrypt, importJWK, JWK, JWTHeaderParameters, JWTPayload, SignJWT } from "jose";
import { CLIENT_ASSERTION_TYPE, CLIENT_URL, GRANT_TYPE } from "../env-variables";
export type PrivateKeyType = { privateSigningKey: string | JWK } | { privateSigningKeyId: string };
export type BaseParams = {
  issuer?: string;
  customClaims?: JWTPayload;
} & PrivateKeyType;

const publicKeyToJwk = async (publicKey: string) => {
  const decoded = Buffer.from(publicKey, "base64").toString();
  const keyObject = JSON.parse(decoded);
  return await importJWK(keyObject, "RSA256");
};

const msToSeconds = (ms: number) => Math.round(ms / 1000);

const signJwt = async (
  jwtPayload: JWTPayload,
  params: BaseParams,
  jwtHeader: JWTHeaderParameters = { alg: "ES256", typ: "JWT" }
) => {
  if ("privateSigningKey" in params && params.privateSigningKey) {
    return await new SignJWT(jwtPayload).setProtectedHeader(jwtHeader).sign(await importJWK(params.privateSigningKey as JWK, "ES256"));
  } else {
    throw new Error("No signing key provided!");
  }
};

const signJwtForToken = async (
  jwtPayload: JWTPayload,
  privateSigningKey: JWK,
  jwtHeader: JWTHeaderParameters = { alg: "ES256", typ: "JWT" }
) => {

    return await new SignJWT(jwtPayload).setProtectedHeader(jwtHeader).sign(await importJWK(privateSigningKey as JWK, "ES256"));
};

export const buildJarAuthorizationRequest = async (params: any) => {
  const jwtPayload: JWTPayload = {
    iss: params.issuer,
    iat: msToSeconds(new Date().getTime()),
    nbf: msToSeconds(new Date().getTime()),
    exp: msToSeconds(new Date().getTime() + 5 * 60 * 1000),
    client_id: params.clientId,
    redirect_uri: params.redirectUrl,
    response_type: "code",
    state: uuid(),
    govuk_signin_journey_id: uuid(),
    sub: uuid(),
    aud: params.audience,
    ...params.claimSet,
  };
  const signedJwt = await signJwt(jwtPayload, params);
  const encryptionKeyJwk = await publicKeyToJwk(params.publicEncryptionKeyBase64);
  const encryptedSignedJwt = await new CompactEncrypt(new TextEncoder().encode(signedJwt))
    .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM" })
    .encrypt(encryptionKeyJwk);
  return {
    client_id: params.clientId,
    request: encryptedSignedJwt,
  };
};


export const buildPrivateKeyJwtParams = async (code: string, params: any, signingKey: JWK) => {
  const signedJwt = await signJwtForToken(params, signingKey);

  return new URLSearchParams({
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    code: code,
    grant_type: GRANT_TYPE,
    redirect_uri: `${CLIENT_URL}/callback`,
    client_assertion: signedJwt
  });
};


export const uuid = () => {
  const hexValues = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += hexValues[(Math.random() * 4 | 8)];
    } else {
      uuid += hexValues[(Math.random() * 16 | 0)];
    }
  }
  return uuid;
}
