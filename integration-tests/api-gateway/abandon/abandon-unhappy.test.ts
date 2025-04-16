import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import {
  abandonEndpoint,
  authorizationEndpoint,
  checkEndpoint,
  createSession,
  getJarAuthorization,
} from "../endpoints";
import { CLIENT_ID, NINO, REDIRECT_URL } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session is invalid and expecting to abandon the journey", () => {
  let sessionId: string;
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
    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
    await authorizationEndpoint(
      privateApi,
      sessionId,
      CLIENT_ID,
      REDIRECT_URL,
      sessionData.state
    );
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

  it("Should receive a 400 response when /abandon endpoint is called with invalid session id", async () => {
    const abandonResponse = await abandonEndpoint(privateApi, {
      "session-id": "test",
    });
    expect(abandonResponse.status).toEqual(400);
  });

  it("Should receive a 400 response when /abandon endpoint is called with no session id", async () => {
    const abandonResponse = await abandonEndpoint(privateApi, {});
    expect(abandonResponse.status).toEqual(400);
  });
});
