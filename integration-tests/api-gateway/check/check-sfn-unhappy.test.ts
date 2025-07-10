import { checkEndpoint, createSession, getJarAuthorization } from "../endpoints";
import { clearAttemptsTable, clearItemsFromTables } from "../../resources/dynamodb-helper";
import { NINO } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session and NINO is invalid", () => {
  let sessionId: string;
  let privateApi: string;
  let sessionTableName: string;
  let sessionData: { session_id: string };

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();

    privateApi = `${process.env.PRIVATE_API}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    const session = await createSession(privateApi, request);
    sessionData = await session.json();
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

  it("Should receive a 400 response when /check endpoint is called without session id value and optional header", async () => {
    sessionId = sessionData.session_id;

    const check = await checkEndpoint(privateApi, {}, NINO);
    const checkData = check.status;
    expect(checkData).toEqual(400);
  });

  it("Should receive a 500 response when /check endpoint is called without NiNo", async () => {
    sessionId = sessionData.session_id;
    const check = await checkEndpoint(
      privateApi,
      { "session-id": sessionId, "txma-audit-encoded": "test encoded header" },
      ""
    );
    const checkData = check.status;
    expect(checkData).toEqual(500);
  });

  it("should 500 when provided with JS in the session header", async () => {
    const maliciousSessionId = `<script>alert('Attack!');</script>`;
    const check = await checkEndpoint(
      privateApi,
      {
        "session-id": maliciousSessionId,
        "txma-audit-encoded": "test encoded header",
      },
      NINO
    );
    expect(check.status).toEqual(400);
  });

  it("should 500 when provided with JS as a nino", async () => {
    const maliciousNino = `<script>alert('Attack!');</script>`;
    const check = await checkEndpoint(
      privateApi,
      {
        "session-id": sessionData.session_id,
        "txma-audit-encoded": "test encoded header",
      },
      maliciousNino
    );
    expect(check.status).toEqual(500);
  });
});
