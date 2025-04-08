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

type Name = {
  name: {
    nameParts: {
      type: string;
      value: string;
    }[];
  }[];
};

export const createPayload = async (
  audienceValue: string,
  privateSigningKey: string,
  publicEncryptionKeyBase64: string,
  sharedClaimsUpdate?: Name
) => {
  const correctClaimSet = await getClaimSet(audienceValue);
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

export const createInvalidSession = async (
  privateApi: string
): Promise<Response> => {
  const sessionApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/session`;
  const sessionResponse = await fetch(sessionApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "localhost",
    },
    body: JSON.stringify(null),
  });

  return sessionResponse;
};

export const createMultipleNamesSession = async (
  audience: string,
  privateApi: string,
  privateSigningKey: string,
  publicEncryptionKeyBase64: string
): Promise<Response> => {
  const ipvCoreAuthorizationUrl = await createPayload(
    audience,
    privateSigningKey,
    publicEncryptionKeyBase64,
    {
      name: [
        {
          nameParts: [
            { type: "GivenName", value: "Peter" },
            { type: "GivenName", value: "Syed Habib" },
            { type: "FamilyName", value: "Martin-Joy" },
          ],
        },
      ],
    }
  );

  const sessionApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/session`;

  const sessionResponse = await fetch(sessionApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "localhost",
    },
    body: JSON.stringify(ipvCoreAuthorizationUrl),
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
