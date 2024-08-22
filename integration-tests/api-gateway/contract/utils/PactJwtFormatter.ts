import { base64url, decodeJwt, decodeProtectedHeader } from "jose";

export const formatJwtForPactTest = (body: string) => {
  const decodedVc = decodeJwt(body);
  const stringifyVc = JSON.stringify(decodedVc);
  const parseVc = JSON.parse(stringifyVc);

  const vcWithReplacedFields = replaceDynamicVcFieldsIfPresent(parseVc);
  const reorderedVc = reorderVc(vcWithReplacedFields);

  return (
    getJwtHeader(body) +
    "." +
    base64url.encode(JSON.stringify(reorderedVc)) +
    "."
  );
};

const replaceDynamicVcFieldsIfPresent = (parseVc: any) => {
  parseVc.nbf = parseVc.nbf == null ? parseVc.nbf : 4070908800;
  parseVc.iss = parseVc.iss == null ? parseVc.iss : "dummyNinoComponentId";
  parseVc.exp = parseVc.exp == null ? parseVc.exp : 4070909400;
  parseVc.jti = parseVc.jti == null ? parseVc.jti : "dummyJti";
  return parseVc;
};

const reorderVc = (vc: any) => ({
  sub: vc.sub,
  nbf: vc.nbf,
  iss: vc.iss,
  exp: vc.exp,
  vc: vc.vc,
  type: vc.type,
  context: vc["@context"],
  jti: vc.jti,
});

const getJwtHeader = (body: string) => {
  const jwtHeader = decodeProtectedHeader(body);
  const jwtHeaderString = JSON.stringify(jwtHeader);
  return base64url.encode(jwtHeaderString);
};
