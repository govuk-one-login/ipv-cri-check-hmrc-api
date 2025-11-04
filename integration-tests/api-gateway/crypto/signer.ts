import { importJWK, JWK, JWTHeaderParameters, JWTPayload, SignJWT } from "jose";
import { createHash } from "crypto";

export const signJwt = async (
  jwtPayload: JWTPayload,
  privateSigningKey: JWK,
  jwtHeader: JWTHeaderParameters = {
    alg: "ES256",
    typ: "JWT",
  }
) => {
  const kid = sha256(privateSigningKey.kid || "");
  const headerWithKid = {
    ...jwtHeader,
    kid,
  };
  return await new SignJWT(jwtPayload).setProtectedHeader(headerWithKid).sign(await importJWK(privateSigningKey, "ES256"));
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
