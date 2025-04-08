import { getSSMParameter } from "../../resources/ssm-param-helper";
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
import { stackOutputs } from "../../resources/cloudformation-helper";
import { createSession } from "../endpoints";

let sessionData: any;
let state: string;
let authCode: any;
let privateAPI: string;
let publicAPI: string;
let preOutput: Partial<{
  PrivateApiGatewayId: string;
  PublicApiGatewayId: string;
}>;
jest.setTimeout(30000);

const createUpdatedClaimset = async (): Promise<any> => {
  const updatedClaimset = await getClaimSet();
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
  let privateSigningKey: JWK;
  let personIDTableName: string;
  let sessionTableName: string;
  let audience: string;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    PrivateApiGatewayId: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
  }>;

  beforeAll(async () => {
    audience = (await getClaimSet()).aud;
    output = await stackOutputs(process.env.STACK_NAME);
    publicEncryptionKeyBase64 =
      (await getSSMParameter(
        "/check-hmrc-cri-api/test/publicEncryptionKeyBase64"
      )) || "";
    privateSigningKey = JSON.parse(
      (await getSSMParameter("/check-hmrc-cri-api/test/privateSigningKey")) ||
        ""
    );
  });

  beforeEach(async () => {
    const claimsSet = await createUpdatedClaimset();
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
    preOutput = await stackOutputs(process.env.STACK_NAME);
    privateAPI = `${preOutput.PrivateApiGatewayId}`;
    publicAPI = `${preOutput.PublicApiGatewayId}`;
    sessionData = await createSession(privateAPI, ipvCoreAuthorizationUrl);
    const session = await sessionData.json();
    sessionId = session.session_id;
  });

  afterEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    personIDTableName = `person-identity-${output.CommonStackName}`;
    sessionTableName = `session-${output.CommonStackName}`;

    await clearItemsFromTables(
      {
        tableName: personIDTableName,
        items: { sessionId: sessionId },
      },
      {
        tableName: `${output.NinoUsersTable}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${output.UserAttemptsTable}`);
  });

  it("Should generate a CI when failing the nino check", async () => {
    expect(sessionData.status).toEqual(201);
    state = sessionData.state;
    const checkApiUrl = `https://${privateAPI}.execute-api.eu-west-2.amazonaws.com/${environment}/check`;
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
      state: state,
      scope: "openid",
    });

    const authApiUrl = `https://${privateAPI}.execute-api.eu-west-2.amazonaws.com/${environment}/authorization?${queryString}`;
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
        aud: audience,
        exp: 41024444800,
        jti: "47e86fa9-3966-49ac-96ab-5fd2a31e9e56",
        redirect_uri: `${CLIENT_URL}/callback`,
      },
      privateSigningKey
    );

    const tokenApiURL = `https://${publicAPI}.execute-api.eu-west-2.amazonaws.com/${environment}/token`;
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

    const credIssApiURL = `https://${publicAPI}.execute-api.eu-west-2.amazonaws.com/${environment}/credential/issue`;
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
