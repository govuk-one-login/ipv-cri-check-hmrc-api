import {
  clearAttemptsTable,
  clearItemsFromTables,
  getItemByKey,
} from "../../resources/dynamodb-helper";
import { loadIntegrationContext } from "../api-test-context/load-integration-context";
import {
  authorizationEndpoint,
  checkEndpoint,
  createPayload,
  createSession,
} from "../endpoints";
import { CLIENT_ID, CLIENT_URL, NINO } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session is valid and expecting to be authorized", () => {
  let authCode: { value: string };
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
    const personIDTableName = `person-identity-common-cri-api`;

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

  it("Should return an authorizationCode when /authorization endpoint is called", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi as string,
      sessionId,
      CLIENT_ID,
      `${CLIENT_URL}/callback`,
      state
    );
    const authData = await authResponse.json();
    authCode = authData.authorizationCode;

    expect(authResponse.status).toEqual(200);
    expect(authCode).toBeDefined();

    const sessionRecord = await getItemByKey(sessionTableName, {
      sessionId: sessionId,
    });

    //Checking DynamoDB to ensure authCode is displayed
    expect(sessionRecord.Item?.authorizationCode).toEqual(authCode.value);
    expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBeDefined();
  });
});
