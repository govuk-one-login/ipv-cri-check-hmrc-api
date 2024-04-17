import { getSSMParameter } from "../../step-functions/aws/resources/ssm-param-helper";
import {
  Payload,
  getJarAuthorizationPayload,
} from "./crypto/create-jar-request-payload";
import { nino, CLIENT_ID, claimSet, CLIENT_URL, env } from "./env-variables";
import { buildPrivateKeyJwtParams } from "./crypto/client";
import { JWK } from "jose";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../step-functions/aws/resources/dynamodb-helper";
import { stackOutputs } from "../../step-functions/aws/resources/cloudformation-helper";
let data: any;
let state: string;
let authCode: any;
let privateAPI: string;
let publicAPI: string;
let preOutput: Partial<{
  PrivateApiGatewayId: string;
  PublicApiGatewayId: string;
}>;
jest.setTimeout(30000);

const environment = process.env.Environment || "dev";

const createSessionId = async (
  ipvCoreAuthorizationUrl: { client_id: any; request: string } | null
): Promise<Response> => {
  preOutput = await stackOutputs(process.env.STACK_NAME);
  privateAPI = `${preOutput.PrivateApiGatewayId}`;
  publicAPI = `${preOutput.PublicApiGatewayId}`;
  const sessionApiUrl = `https://${privateAPI}.execute-api.eu-west-2.amazonaws.com/${env}/session`;
  const sessionResponse = await fetch(sessionApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "localhost",
    },
    body: JSON.stringify(ipvCoreAuthorizationUrl),
  });
  data = sessionResponse;
  const session = await sessionResponse.json();
  console.log("first session response", JSON.stringify(session));
  return session;
};

describe("Private API Happy Path Tests", () => {
  let session: any;
  let sessionId: string;
  let publicEncryptionKeyBase64: string;
  let privateSigningKey: JWK;
  let personIDTableName: string;
  let sessionTableName: string;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    PrivateApiGatewayId: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
  }>;

  beforeAll(async () => {
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
    const payload = {
      clientId: CLIENT_ID,
      audience: `https://review-hc.${environment}.account.gov.uk`,
      authorizationEndpoint: `https://review-hc.${environment}.account.gov.uk/oauth2/authorize`,
      redirectUrl: `${CLIENT_URL}/callback`,
      publicEncryptionKeyBase64: publicEncryptionKeyBase64,
      privateSigningKey: privateSigningKey,
      issuer: CLIENT_URL,
      claimSet: claimSet,
    } as Payload;
    const ipvCoreAuthorizationUrl = await getJarAuthorizationPayload(payload);
    console.log("ipv core url", ipvCoreAuthorizationUrl);
    session = await createSessionId(ipvCoreAuthorizationUrl);
    sessionId = session.session_id;
  });

  afterEach(async () => {
    console.log(sessionId);
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

  it("E2E Happy Path Test", async () => {
    expect(data.status).toEqual(201);
    state = session.state;
    const checkApiUrl = `https://${privateAPI}.execute-api.eu-west-2.amazonaws.com/${env}/check`;
    const jsonData = JSON.stringify({ nino: nino });

    const checkResponse = await fetch(checkApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "session-id": sessionId,
      },
      body: jsonData,
    });

    const checkData = checkResponse.status;
    expect(checkData).toEqual(200);

    const queryString = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${CLIENT_URL}/callback`,
      response_type: "code",
      state: state,
      scope: "openid",
    });

    const authApiUrl = `https://${privateAPI}.execute-api.eu-west-2.amazonaws.com/${env}/authorization?${queryString}`;
    const authResponse = await fetch(authApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "session-id": sessionId,
      },
    });

    const authData = await authResponse.json();
    console.log("auth response", authData);
    expect(authResponse.status).toEqual(200);
    authCode = authData.authorizationCode;

    const tokenData = await buildPrivateKeyJwtParams(
      authCode.value,
      {
        iss: "ipv-core-stub-aws-prod",
        sub: "ipv-core-stub-aws-prod",
        aud: "https://review-hc.dev.account.gov.uk",
        exp: 41024444800,
        jti: "47e86fa9-3966-49ac-96ab-5fd2a31e9e56",
        redirect_uri: `${CLIENT_URL}/callback`,
      },
      privateSigningKey
    );

    console.log("token data", tokenData);

    const tokenApiURL = `https://${publicAPI}.execute-api.eu-west-2.amazonaws.com/${env}/token`;
    const tokenResponse = await fetch(tokenApiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: tokenData,
    });
    const token = await tokenResponse.json();
    console.log("token response", token);
    expect(tokenResponse.status).toEqual(200);

    const accessToken = token.access_token;

    const credIssApiURL = `https://${publicAPI}.execute-api.eu-west-2.amazonaws.com/${env}/credential/issue`;
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
  });
});
