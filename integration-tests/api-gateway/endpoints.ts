import { environment, testResourcesStack } from "./env-variables";
import { stackOutputs } from "../resources/cloudformation-helper";
import { signedFetch } from "../resources/fetch";

export type JWTClaimsSet = {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  nbf: number;
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  govuk_signin_journey_id: string;
  shared_claims?: undefined;
  evidence_requested?: undefined;
  context?: string;
};
type JarAuthorizationOptions = {
  clientId?: string;
  aud?: string;
  iss?: string;
  claimsOverride?: unknown;
  evidence_requested?: unknown;
};
export const getJarAuthorization = async ({
  clientId,
  aud,
  iss,
  claimsOverride,
  evidence_requested,
}: JarAuthorizationOptions = {}) => {
  const { TestHarnessExecuteUrl: testHarnessExecuteUrl } =
    await stackOutputs(testResourcesStack);

  const body = {
    aud,
    client_id: clientId,
    iss,
    shared_claims: claimsOverride,
    evidence_requested,
  } as JWTClaimsSet;

  return await signedFetch(`${testHarnessExecuteUrl}start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
