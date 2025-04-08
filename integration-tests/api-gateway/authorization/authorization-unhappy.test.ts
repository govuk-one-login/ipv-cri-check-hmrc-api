import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import { loadIntegrationContext } from "../api-test-context/load-integration-context";
import {
  authorizationEndpoint,
  checkEndpoint,
  createPayload,
  createSession,
} from "../endpoints";
import { CLIENT_ID, CLIENT_URL, NINO } from "../env-variables";

jest.setTimeout(40_000);
describe("Given the session is invalid and expecting it not to be authorized", () => {
  let state: string;
  let sessionId: string;
  let sessionResponse: Response;
  let privateApi: string;
  let audience: string;
  let privateSigningKey: string;
  let publicEncryptionKeyBase64: string;
  let ninoUsersTable: string;
  let userAttemptsTable: string;
  const sessionTableName = "session-common-cri-api";

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
    const sessionData = await sessionResponse.json();
    sessionId = sessionData.session_id;
    state = sessionData.state;

    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
  });

  afterEach(async () => {
    const personIDTableName = "person-identity-common-cri-api";

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

  it("Should return an 400 response when /authorization endpoint is called when session id is empty", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      "",
      CLIENT_ID,
      `${CLIENT_URL}/callback`,
      state
    );
    await authResponse.json();

    expect(authResponse.status).toEqual(400);
  });

  it("Should return an 400 response when /authorization endpoint is called when cliend id is empty", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      sessionId,
      "",
      `${CLIENT_URL}/callback`,
      state
    );
    await authResponse.json();

    expect(authResponse.status).toEqual(400);
  });

  it("Should return an 400 response when /authorization endpoint is called when callback is empty", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      sessionId,
      CLIENT_ID,
      "",
      state
    );
    await authResponse.json();

    expect(authResponse.status).toEqual(400);
  });

  it("Should return an 400 response when /authorization endpoint is called when state is empty", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      sessionId,
      CLIENT_ID,
      `${CLIENT_URL}/callback`,
      ""
    );
    await authResponse.json();

    expect(authResponse.status).toEqual(200);
  });
});
