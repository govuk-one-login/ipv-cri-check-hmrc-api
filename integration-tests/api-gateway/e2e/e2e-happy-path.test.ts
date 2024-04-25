import { getSSMParameter } from "../../step-functions/aws/resources/ssm-param-helper";
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

const createSessionId = async (
  ipvCoreAuthorizationUrl: { client_id: any; request: string } | null
): Promise<Response> => {
  preOutput = await stackOutputs(process.env.STACK_NAME);
  privateAPI = `${preOutput.PrivateApiGatewayId}`;
  publicAPI = `${preOutput.PublicApiGatewayId}`;
  const sessionApiUrl = `https://${privateAPI}.execute-api.eu-west-2.amazonaws.com/${environment}/session`;
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
  return session;
};

describe("End to end happy path journey", () => {
  let session: any;
  let sessionId: string;
  let publicEncryptionKeyBase64: string;
  let privateSigningKey: JWK;
  let personIdTableName: string;
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
    const claimsSet = await getClaimSet();
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
    session = await createSessionId(ipvCoreAuthorizationUrl);
    sessionId = session.session_id;
  });

  afterEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    personIdTableName = `person-identity-${output.CommonStackName}`;
    sessionTableName = `session-${output.CommonStackName}`;

    await clearItemsFromTables(
      {
        tableName: personIdTableName,
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

  it("Should receive a successful VC when valid name and NINO are entered", async () => {
    expect(data.status).toEqual(201);
    state = session.state;
    const checkApiUrl = `https://${privateAPI}.execute-api.eu-west-2.amazonaws.com/${environment}/check`;
    const jsonData = JSON.stringify({ nino: NINO });

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
  });
});
