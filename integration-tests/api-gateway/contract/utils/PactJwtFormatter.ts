import { base64url, decodeJwt, decodeProtectedHeader } from "jose";
import { JWTClaimsSet } from "../../types";

export const formatJwtForPactTest = (body: string) => {
  const decodedVc = decodeJwt(body);
  const stringifyVc = JSON.stringify(decodedVc);
  const parseVc = JSON.parse(stringifyVc);

  const vcWithReplacedFields = replaceDynamicVcFieldsIfPresent(parseVc);
  return `${getJwtHeader(body)}.${base64url.encode(JSON.stringify(vcWithReplacedFields))}.`;
};

const replaceDynamicVcFieldsIfPresent = (parseVc: JWTClaimsSet) => {
  parseVc.nbf = parseVc.nbf == null ? parseVc.nbf : 4070908800;
  parseVc.iss = parseVc.iss == null ? parseVc.iss : "dummyNinoComponentId";
  parseVc.exp = parseVc.exp == null ? parseVc.exp : 4070909400;
  parseVc.jti = parseVc.jti == null ? parseVc.jti : "dummyJti";
  return parseVc;
};

const getJwtHeader = (body: string) => {
  const jwtHeader = decodeProtectedHeader(body);
  const jwtHeaderString = JSON.stringify(jwtHeader);
  return base64url.encode(jwtHeaderString);
};
