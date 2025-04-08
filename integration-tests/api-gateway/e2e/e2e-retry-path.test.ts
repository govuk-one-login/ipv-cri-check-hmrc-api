import { getSSMParameters } from "../../resources/ssm-param-helper";
import {
  NINO,
  getClaimSet,
  environment,
  testResourcesStack,
} from "../env-variables";
import { buildPrivateKeyJwtParams } from "../crypto/client";
import { decodeJwt, JWK } from "jose";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import { stackOutputs } from "../../resources/cloudformation-helper";
import { createSession, getJarAuthorization } from "../endpoints";

let sessionData: Response;
let state: string;
let authCode: { value: string };
let privateApi: string;
let publicApi: string;

jest.setTimeout(30_000);

describe("Retry Scenario Path Tests", () => {
  let sessionId: string;
  let audience: string | undefined;
  let redirectUri: string | undefined;
  let privateSigningKey: JWK | undefined;
  let testHarnessExecuteUrl: string;

  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    PrivateApiGatewayId: string;
    PublicApiGatewayId: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
  }>;

  const clientId = "ipv-core-stub-aws-headless";
  let commonStack: string;

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    commonStack = `${output.CommonStackName}`;
    privateApi = `${output.PrivateApiGatewayId}`;
    publicApi = `${output.PublicApiGatewayId}`;

    let privateSigningKeyValue: string | undefined;
    [audience, redirectUri, privateSigningKeyValue] = await getSSMParameters(
      `/${commonStack}/clients/${clientId}/jwtAuthentication/audience`,
      `/${commonStack}/clients/${clientId}/jwtAuthentication/redirectUri`,
      `/${testResourcesStack}/${clientId}/privateSigningKey`
    );

    privateSigningKey = JSON.parse(privateSigningKeyValue as string);

    ({ TestHarnessExecuteUrl: testHarnessExecuteUrl } =
      await stackOutputs(testResourcesStack));
    process.env.CLIENTID = clientId;
    process.env.CLIENT_URL = testHarnessExecuteUrl.replace(/\/callback$/, "");
  });

  beforeEach(async () => {
    const payload = await getClaimSet(audience);
    payload.shared_claims.name[0].nameParts[0].value = "Error";
    payload.shared_claims.name[0].nameParts[1].value = "NoCidForNino";
    payload.evidence_requested = {
      scoringPolicy: "gpg45",
      strengthScore: 2,
    };
    const data = await getJarAuthorization({
      claimsOverride: payload.shared_claims,
      evidence_requested: payload.evidence_requested,
    });
    const request = await data.json();
    sessionData = await createSession(privateApi, request);
    const session = await sessionData.json();
    state = session.state;
    sessionId = session.session_id;

    expect(sessionData.status).toEqual(201);
  });

  afterEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);

    await clearItemsFromTables(
      {
        tableName: `person-identity-${commonStack}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: `${output.NinoUsersTable}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: `session-${commonStack}`,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${output.UserAttemptsTable}`);
  });

  it("Should generate a CI when failing the nino check", async () => {
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
      client_id: clientId,
      redirect_uri: redirectUri as string,
      response_type: "code",
      state: state,
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
        iss: clientId,
        sub: clientId,
        aud: audience,
        exp: 41024444800,
        jti: "47e86fa9-3966-49ac-96ab-5fd2a31e9e56",
        redirect_uri: redirectUri,
      },
      privateSigningKey as JWK
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
