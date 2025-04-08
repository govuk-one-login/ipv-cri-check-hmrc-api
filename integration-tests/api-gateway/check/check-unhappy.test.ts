import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import { CLIENT_ID, CLIENT_URL, NINO } from "../env-variables";
import { loadIntegrationContext } from "../api-test-context/load-integration-context";
import {
  createPayload,
  createSession,
  authorizationEndpoint,
  checkEndpoint,
} from "../endpoints";

jest.setTimeout(30_000);
describe("Given the session and NINO is invalid", () => {
  let state: string;
  let sessionId: string;
  let sessionResponse: Response;
  let privateApi: string;
  let audience: string;
  let privateSigningKey: string;
  let publicEncryptionKeyBase64: string;
  let ninoUsersTable: string;
  let userAttemptsTable: string;

  beforeAll(async () => {
    ({
      privateApi,
      audience,
      privateSigningKey,
      publicEncryptionKeyBase64,
      ninoUsersTable,
      userAttemptsTable,
    } = await loadIntegrationContext());
  });

  beforeEach(async () => {
    const claimSet = await createPayload(
      audience,
      privateSigningKey,
      publicEncryptionKeyBase64
    );
    sessionResponse = await createSession(privateApi, claimSet);

    await authorizationEndpoint(
      privateApi,
      sessionId,
      CLIENT_ID,
      `${CLIENT_URL}/callback`,
      state
    );

    const jsonSession = await sessionResponse.json();

    sessionId = jsonSession.session_id;
    state = jsonSession.state;

    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
  });

  afterEach(async () => {
    const personIDTableName = "person-identity-common-cri-api";
    const sessionTableName = "session-common-cri-api";

    await clearItemsFromTables(
      {
        tableName: personIDTableName,
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

  it("Should receive a 400 response when /check endpoint is called without session id value and optional header", async () => {
    const check = await checkEndpoint(privateApi, {}, NINO);
    const checkData = check.status;

    expect(checkData).toEqual(400);
  });

  it("Should receive a 500 response when /check endpoint is called without NiNo", async () => {
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
      privateApi as string,
      {
        "session-id": maliciousSessionId,
        "txma-audit-encoded": "test encoded header",
      },
      NINO
    );

    expect(check.status).toEqual(500);
  });

  it("should 500 when provided with JS as a nino", async () => {
    const maliciousNino = `<script>alert('Attack!');</script>`;

    const check = await checkEndpoint(
      privateApi as string,
      {
        "session-id": sessionId,
        "txma-audit-encoded": "test encoded header",
      },
      maliciousNino
    );

    expect(check.status).toEqual(500);
  });
});
