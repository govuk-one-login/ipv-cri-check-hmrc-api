import {
  clearAttemptsTable,
  clearItemsFromTables,
  getItemByKey,
} from "../../resources/dynamodb-helper";
import {
  abandonEndpoint,
  authorizationEndpoint,
  checkEndpoint,
  createPayload,
  createSession,
} from "../endpoints";
import { CLIENT_ID, CLIENT_URL, NINO } from "../env-variables";
import { loadIntegrationContext } from "../api-test-context/load-integration-context";

jest.setTimeout(30_000);

describe("Given the session is valid and expecting to abandon the journey", () => {
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

  it("Should receive a 200 response when /abandon endpoint is called without optional headers", async () => {
    await authorizationEndpoint(
      privateApi,
      sessionId,
      CLIENT_ID,
      `${CLIENT_URL}/callback`,
      state
    );
    const abandonResponse = await abandonEndpoint(privateApi as string, {
      "session-id": sessionId,
    });
    expect(abandonResponse.status).toEqual(200);

    const sessionRecord = await getItemByKey(sessionTableName, {
      sessionId: sessionId,
    });

    //Checking DynamoDB to ensure authCode is removed
    expect(sessionRecord.Item?.authorizationCode).toBeUndefined();
    expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBe(0);
  });

  it("Should receive a 200 response when /abandon endpoint is called with optional headers", async () => {
    const abandonResponse = await abandonEndpoint(privateApi as string, {
      "session-id": sessionId,
      "txma-audit-encoded": "test encoded header",
    });
    expect(abandonResponse.status).toEqual(200);

    const sessionRecord = await getItemByKey(sessionTableName, {
      sessionId: sessionId,
    });

    //Checking DynamoDB to ensure authCode is removed
    expect(sessionRecord.Item?.authorizationCode).toBeUndefined();
    expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBe(0);
  });
});
