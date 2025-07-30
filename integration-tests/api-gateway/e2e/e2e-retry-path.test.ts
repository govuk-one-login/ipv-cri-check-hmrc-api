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
let state: string;
let authCode: { value: string };
let privateApi: string;
let publicApi: string;

jest.setTimeout(35_000);

describe("Retry Scenario Path Tests", () => {
  let sessionId: string;
  let sessionTableName: string;
  let privateSigningKey: JWK | undefined;

  beforeAll(async () => {
    privateApi = `${process.env.PRIVATE_API}`;
    publicApi = `${process.env.PUBLIC_API}`;

    sessionTableName = `${process.env.SESSION_TABLE}`;

    privateSigningKey = JSON.parse(`${await getSSMParameter(`/${testResourcesStack}/${CLIENT_ID}/privateSigningKey`)}`);
  });

  beforeEach(async () => {
    const payload = await getClaimSet();
    payload.shared_claims.name[0].nameParts[0].value = "Error";
    payload.shared_claims.name[0].nameParts[1].value = "NoCidForNino";
    payload.evidence_requested = {
      scoringPolicy: "gpg45",
      strengthScore: 2,
    };
    const data = await getJarAuthorization({
      claimsOverride: payload.shared_claims,
      evidenceRequested: payload.evidence_requested,
    });
    const request = await data.json();
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

  it("Should generate a CI when failing the nino check", async () => {
    let checkRetryResponse = await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);

    const checkData = checkRetryResponse.status;
    const checkBody = JSON.parse(await checkRetryResponse.text());

    expect(checkData).toEqual(200);
    expect(checkBody).toStrictEqual({
      requestRetry: true,
    });

    checkRetryResponse = await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);

    const checkResponseBody = JSON.parse(await checkRetryResponse.text());

    expect(checkRetryResponse.status).toEqual(200);
    expect(checkResponseBody).toStrictEqual({
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
    const credIssApiURL = `https://${publicApi}.execute-api.eu-west-2.amazonaws.com/${environment}/credential/issue-test`;
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
        txn: "",
        type: "IdentityCheck",
        validityScore: 0,
        strengthScore: 2,
        failedCheckDetails: [{ checkMethod: "data" }],
        ci: [expect.any(String)],
      },
    ]);
  });
});
