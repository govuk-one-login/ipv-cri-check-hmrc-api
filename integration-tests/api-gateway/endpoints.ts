import { getSSMParameter } from "../resources/ssm-param-helper";
import {
  Payload,
  getJarAuthorizationPayload,
} from "./crypto/create-jar-request-payload";
import {
  getClaimSet,
  CLIENT_ID,
  CLIENT_URL,
  environment,
} from "./env-variables";
import { stackOutputs } from "../resources/cloudformation-helper";
import { signedFetch } from "../resources/fetch";

let publicEncryptionKeyBase64: string;
let privateSigningKey: any;
let privateAPI: string;
let preOutput: Partial<{
  PrivateApiGatewayId: string;
}>;

type Name = {
  name: {
    nameParts: {
      type: string;
      value: string;
    }[];
  }[];
};

export const createPayload = async (sharedClaimsUpdate?: Name) => {
  publicEncryptionKeyBase64 =
    (await getSSMParameter(
      "/check-hmrc-cri-api/test/publicEncryptionKeyBase64"
    )) || "";
  privateSigningKey = JSON.parse(
    (await getSSMParameter("/check-hmrc-cri-api/test/privateSigningKey")) || ""
  );

  const correctClaimSet = await getClaimSet();
  const updateClaimset = {
    ...correctClaimSet,
    ...sharedClaimsUpdate,
    name: sharedClaimsUpdate?.name || correctClaimSet.shared_claims.name,
  };
  const audience = correctClaimSet.aud;
  const payload = {
    clientId: CLIENT_ID,
    audience,
    authorizationEndpoint: `${audience}/oauth2/authorize`,
    redirectUrl: `${CLIENT_URL}/callback`,
    publicEncryptionKeyBase64: publicEncryptionKeyBase64,
    privateSigningKey: privateSigningKey,
    issuer: CLIENT_URL,
    claimSet: updateClaimset,
  } as unknown as Payload;
  const ipvCoreAuthorizationUrl = await getJarAuthorizationPayload(payload);
  return ipvCoreAuthorizationUrl;
};

export const getJarAuthorization = async (
  clientId: string,
  aud: string,
  iss: string
) => {
  const { TestHarnessExecuteUrl: testHarnessExecuteUrl } =
    await stackOutputs("test-resources");

  return await signedFetch(`${testHarnessExecuteUrl}start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ aud, client_id: clientId, iss }),
  });
};
export const createSession = async (
  privateApi: string,
  payload: unknown
): Promise<Response> => {
  const sessionApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/session`;
  const sessionResponse = await fetch(sessionApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "localhost",
    },
    body: JSON.stringify(payload),
  });

  return sessionResponse;
};

export const createMultipleNamesSession = async (
  privateApi: string,
  payload: unknown
): Promise<Response> => {
  const sessionApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/session`;
  const sessionResponse = await fetch(sessionApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "localhost",
    },
    body: JSON.stringify(payload),
  });

  return sessionResponse;
};

export const checkEndpoint = async (
  privateApi: string,
  headers: { "session-id"?: string; "txma-audit-encoded"?: string },
  nino: string
): Promise<Response> => {
  const checkApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/check`;
  const jsonData = JSON.stringify({ nino: nino });
  const checkResponse = await fetch(checkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: jsonData,
  });

  return checkResponse;
};

export const authorizationEndpoint = async (
  privateApi: string,
  sessionId: string,
  client_id: string,
  redirect_uri: string,
  state: string
): Promise<Response> => {
  const queryParams = {
    client_id: client_id,
    redirect_uri: redirect_uri,
    response_type: "code",
    state: state,
    scope: "openid",
  };
  const queryString = new URLSearchParams(queryParams);

  const authApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/authorization?${queryString}`;
  const authResponse = await fetch(authApiUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "session-id": sessionId,
    },
  });

  return authResponse;
};

export const abandonEndpoint = async (
  privateApi: string,
  headers: {
    "session-id"?: string;
    "txma-audit-encoded"?: string;
  }
): Promise<Response> => {
  const abandonUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/abandon`;
  const abandonResponse = await fetch(abandonUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({}),
  });
  return abandonResponse;
};
