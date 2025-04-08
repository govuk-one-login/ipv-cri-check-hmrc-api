import {
  Payload,
  getJarAuthorizationPayload,
} from "../crypto/create-jar-request-payload";
import {
  NINO,
  CLIENT_ID,
  getClaimSet,
  CLIENT_URL,
  environment,
} from "../env-variables";
import { buildPrivateKeyJwtParams } from "../crypto/client";
import { JWK, decodeJwt } from "jose";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import { createSession } from "../endpoints";
import { loadIntegrationContext } from "../api-test-context/load-integration-context";

let data: any;
let authCode: { value: string };

jest.setTimeout(30_000);

const createUpdatedClaimset = async (audience: string) => {
  const updatedClaimset = await getClaimSet(audience);
  updatedClaimset.shared_claims.name[0].nameParts[0].value = "Error";
  updatedClaimset.shared_claims.name[0].nameParts[1].value = "NoCidForNino";
  updatedClaimset.evidence_requested = {
    scoringPolicy: "gpg45",
    strengthScore: 2,
  };
  return updatedClaimset;
};

describe("Retry Scenario Path Tests", () => {
  let sessionId: string;
  let publicEncryptionKeyBase64: string;
  let privateSigningKey: string;
  let personIdTableName: string;
  let sessionTableName: string;
  let ninoUsersTable: string;
  let userAttemptsTable: string;
  let audienceUrl: string;
  let privateApi: string;
  let publicApi: string;

  beforeAll(async () => {
    ({
      privateApi,
      publicApi,
      audience: audienceUrl,
      privateSigningKey,
      publicEncryptionKeyBase64,
      ninoUsersTable,
      userAttemptsTable,
    } = await loadIntegrationContext());
    const claimsSet = await createUpdatedClaimset(audienceUrl);
    const audience = claimsSet.aud;
    const payload = {
      clientId: CLIENT_ID,
      audience,
      authorizationEndpoint: `${audience}/oauth2/authorize`,
      redirectUrl: `${CLIENT_URL}/callback`,
      publicEncryptionKeyBase64: publicEncryptionKeyBase64,
      privateSigningKey: privateSigningKey,
      issuer: CLIENT_URL,
      claimSet: claimsSet,
    } as unknown as Payload;

    const ipvCoreAuthorizationUrl = await getJarAuthorizationPayload(payload);
    const sessionResponse = await createSession(
      privateApi as string,
      ipvCoreAuthorizationUrl
    );
    data = sessionResponse;
    const session = await sessionResponse.json();
    sessionId = session.session_id;
  });

  afterEach(async () => {
    personIdTableName = "person-identity-common-cri-api";
    sessionTableName = "session-common-cri-api";

    await clearItemsFromTables(
      {
        tableName: personIdTableName,
        items: { sessionId: sessionId },
      },
      {
        tableName: ninoUsersTable,
        items: { sessionId: sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, userAttemptsTable);
  });

  it("Should generate a CI when failing the nino check", async () => {
    expect(data.status).toEqual(201);
    const checkApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/check`;
    const jsonData = JSON.stringify({ nino: NINO });

    const checkRetryResponse = await fetch(checkApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "session-id": sessionId,
      },
      body: jsonData,
    });

    const checkData = checkRetryResponse.status;
    const checkBody = JSON.parse(await checkRetryResponse.text());
    expect(checkData).toEqual(200);
    expect(checkBody).toStrictEqual({
      requestRetry: true,
    });

    const checkResponse = await fetch(checkApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "session-id": sessionId,
      },
      body: jsonData,
    });
    const checkResponseBody = JSON.parse(await checkResponse.text());
    expect(checkResponse.status).toEqual(200);
    expect(checkResponseBody).toStrictEqual({
      requestRetry: false,
    });

    const queryString = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${CLIENT_URL}/callback`,
      response_type: "code",
      state: data.state,
      scope: "openid",
    });

    const authApiUrl = `https://${privateApi}.execute-api.eu-west-2.amazonaws.com/${environment}/authorization?${queryString}`;
    const authResponse = await fetch(authApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "session-id": sessionId,
      },
    });

    const authData = await authResponse.json();
    expect(authResponse.status).toEqual(200);
    authCode = authData.authorizationCode;

    const tokenData = await buildPrivateKeyJwtParams(
      authCode.value,
      {
        iss: CLIENT_ID,
        sub: CLIENT_ID,
        aud: audienceUrl,
        exp: 41024444800,
        jti: "47e86fa9-3966-49ac-96ab-5fd2a31e9e56",
        redirect_uri: `${CLIENT_URL}/callback`,
      },
      privateSigningKey as unknown as JWK
    );

    const tokenApiURL = `https://${publicApi}.execute-api.eu-west-2.amazonaws.com/${environment}/token`;
    const tokenResponse = await fetch(tokenApiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: tokenData,
    });
    const token = await tokenResponse.json();
    expect(tokenResponse.status).toEqual(200);
    const accessToken = token.access_token;

    const credIssApiURL = `https://${publicApi}.execute-api.eu-west-2.amazonaws.com/${environment}/credential/issue`;
    const credIssResponse = await fetch(credIssApiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(credIssResponse.status).toEqual(200);

    const VC = await credIssResponse.text();
    expect(VC).toBeDefined();

    const decodedVc = decodeJwt(VC);
    const stringifyVc = JSON.stringify(decodedVc);
    const parseVc = JSON.parse(stringifyVc);

    expect(parseVc.vc.evidence[0].validityScore).toBe(0);
    expect(parseVc.vc.evidence[0].strengthScore).toBe(2);
    expect(parseVc.vc.evidence[0].ci).toBeDefined();
  });
});
