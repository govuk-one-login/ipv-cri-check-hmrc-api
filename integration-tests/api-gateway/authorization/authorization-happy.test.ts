import {
  clearAttemptsTable,
  clearItemsFromTables,
  getItemByKey,
} from "../../resources/dynamodb-helper";
import {
  authorizationEndpoint,
  checkEndpoint,
  createSession,
  getJarAuthorization,
} from "../endpoints";
import { CLIENT_ID, NINO, REDIRECT_URL } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session is valid and expecting to be authorized", () => {
  let authCode: { value: string };
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

  it("Should return an authorizationCode when /authorization endpoint is called", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      sessionId,
      CLIENT_ID,
      REDIRECT_URL,
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
