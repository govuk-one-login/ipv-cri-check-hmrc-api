import { getSSMParameter } from "../../resources/ssm-param-helper";
import {
  NINO,
  getClaimSet,
  environment,
  testResourcesStack,
  CLIENT_ID,
  REDIRECT_URL,
  AUDIENCE,
} from "../env-variables";
import { decodeJwt, JWK } from "jose";
import { clearAttemptsTable, clearItemsFromTables } from "../../resources/dynamodb-helper";
import { authorizationEndpoint, checkEndpoint, createSession, getJarAuthorization } from "../endpoints";
import { generatePrivateJwtParams } from "../crypto/private-key-jwt-helper";

let sessionData: Response;
let authCode: { value: string };
let privateApi: string;
let publicApi: string;

jest.setTimeout(30_000);

describe("End to end happy path journey", () => {
  let state: string;
  let sessionId: string;
  let sessionTableName: string;
  let privateSigningKey: JWK | undefined;

  beforeAll(async () => {
    privateSigningKey = JSON.parse(`${await getSSMParameter(`/${testResourcesStack}/${CLIENT_ID}/privateSigningKey`)}`);
  });

  beforeEach(async () => {
    const payload = await getClaimSet();
    payload.evidence_requested = {
      scoringPolicy: "gpg45",
      strengthScore: 2,
    };
    const data = await getJarAuthorization({
      claimsOverride: payload.shared_claims,
      evidenceRequested: payload.evidence_requested,
    });
    const request = await data.json();
    privateApi = `${process.env.PRIVATE_API}`;
    publicApi = `${process.env.PUBLIC_API}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    sessionData = await createSession(privateApi, request);
    const session = await sessionData.json();
    state = session.state;
    sessionId = session.session_id;

    expect(sessionData.status).toEqual(201);
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: `${process.env.NINO_USERS_TABLE}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${process.env.USERS_ATTEMPTS_TABLE}`);
  });

  it("Should receive a successful VC when valid name and NINO are entered", async () => {
    const checkRetryResponse = await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);

    const checkData = checkRetryResponse.status;
    const checkBody = JSON.parse(await checkRetryResponse.text());
    expect(checkData).toEqual(200);
    expect(checkBody).toStrictEqual({
      requestRetry: false,
    });

    const authResponse = await authorizationEndpoint(privateApi, sessionId, CLIENT_ID, REDIRECT_URL, state);

    const authData = await authResponse.json();
    expect(authResponse.status).toEqual(200);

    authCode = authData.authorizationCode;
    const tokenData = await generatePrivateJwtParams(
      CLIENT_ID,
      authCode.value,
      REDIRECT_URL,
      privateSigningKey as JWK,
      AUDIENCE
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
    expect(credIssResponse.status).toBe(200);

    const VC = await credIssResponse.text();
    expect(credIssResponse.headers.get("Content-Type")).toBe("application/jwt");
    expect(VC).toBeDefined();

    const decodedVc = decodeJwt(VC);
    const stringifyVc = JSON.stringify(decodedVc);
    const parseVc = JSON.parse(stringifyVc);

    expect(parseVc.vc.evidence).toEqual([
      {
        txn: "mock_txn_header",
        type: "IdentityCheck",
        validityScore: 2,
        strengthScore: 2,
        checkDetails: [{ checkMethod: "data" }],
      },
    ]);
  });
});
