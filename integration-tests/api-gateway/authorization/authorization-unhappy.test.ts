import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAttemptsTable, clearItemsFromTables } from "../../resources/dynamodb-helper";
import { authorizationEndpoint, checkEndpoint, createSession, getJarAuthorization } from "../endpoints";
import { CLIENT_ID, NINO, REDIRECT_URL } from "../env-variables";

describe("Given the session is invalid and expecting it not to be authorized", { timeout: 30_000 /* 30s */ }, () => {
  let sessionId: string;
  let state: string;
  let privateApi: string;
  let sessionTableName: string;

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();
    privateApi = `${process.env.PRIVATE_API}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    const session = await createSession(privateApi, request);
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    state = sessionData.state;
    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
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

  it("Should return an 400 response when /authorization endpoint is called when session id is empty", async () => {
    const authResponse = await authorizationEndpoint(privateApi, "", CLIENT_ID, REDIRECT_URL, state);
    await authResponse.json();

    expect(authResponse.status).toEqual(400);
  });

  it("Should return an 400 response when /authorization endpoint is called when client id is empty", async () => {
    const authResponse = await authorizationEndpoint(privateApi, sessionId, "", REDIRECT_URL, state);
    await authResponse.json();

    expect(authResponse.status).toEqual(400);
  });

  it("Should return an 400 response when /authorization endpoint is called when callback is empty", async () => {
    const authResponse = await authorizationEndpoint(privateApi, sessionId, CLIENT_ID, "", state);
    await authResponse.json();

    expect(authResponse.status).toEqual(400);
  });

  it("Should return an 400 response when /authorization endpoint is called when state is empty", async () => {
    const authResponse = await authorizationEndpoint(privateApi, sessionId, CLIENT_ID, REDIRECT_URL, "");
    await authResponse.json();

    expect(authResponse.status).toEqual(200);
  });
});
