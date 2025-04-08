import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import {
  abandonEndpoint,
  checkEndpoint,
  createPayload,
  createSession,
} from "../endpoints";
import { NINO } from "../env-variables";
import { loadIntegrationContext } from "../api-test-context/load-integration-context";

jest.setTimeout(30_000);

describe("Given the session is invalid and expecting to abandon the journey", () => {
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
    const sessionData = await sessionResponse.json();
    sessionId = sessionData.session_id;

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
