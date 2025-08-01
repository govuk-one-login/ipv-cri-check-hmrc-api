import { clearAttemptsTable, clearItemsFromTables, getItemByKey } from "../../resources/dynamodb-helper";
import { ABANDONED_EVENT_NAME, AuditEvent, baseExpectedEvent, pollForTestHarnessEvents } from "../audit";
import {
  abandonEndpoint,
  authorizationEndpoint,
  checkEndpoint,
  createSession,
  getJarAuthorization,
} from "../endpoints";
import { CLIENT_ID, NINO, REDIRECT_URL } from "../env-variables";

jest.setTimeout(60_000); // 1 min

describe("Given the session is valid and expecting to abandon the journey", () => {
  let sessionId: string;
  let clientId: string;
  let sessionTableName: string;
  let privateApi: string;

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();
    clientId = request.client_id;
    privateApi = `${process.env.PRIVATE_API}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    const session = await createSession(privateApi, request);
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
    await authorizationEndpoint(privateApi, sessionId, CLIENT_ID, REDIRECT_URL, sessionData.state);
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
        items: { sessionId },
      },
      {
        tableName: `${process.env.NINO_USERS_TABLE}`,
        items: { sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${process.env.USERS_ATTEMPTS_TABLE}`);
  });

  it("Should receive a 200 response when /abandon endpoint is called without optional headers", async () => {
    const abandonResponse = await abandonEndpoint(privateApi, {
      "session-id": sessionId,
    });
    expect(abandonResponse.status).toEqual(200);

    const sessionRecord = await getItemByKey(sessionTableName, {
      sessionId,
    });

    //Checking DynamoDB to ensure authCode is removed
    expect(sessionRecord.Item?.authorizationCode).toBeUndefined();
    expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBe(0);

    const events = await pollForTestHarnessEvents(ABANDONED_EVENT_NAME, sessionId);

    expect(events).toHaveLength(1);
    expect(events[0].event).toStrictEqual<AuditEvent>(baseExpectedEvent(ABANDONED_EVENT_NAME, clientId, sessionId));
  });

  it("Should receive a 200 response when /abandon endpoint is called with optional headers", async () => {
    const abandonResponse = await abandonEndpoint(privateApi, {
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

    const events = await pollForTestHarnessEvents(ABANDONED_EVENT_NAME, sessionId);

    expect(events).toHaveLength(1);
    expect(events[0].event).toStrictEqual<AuditEvent>({
      ...baseExpectedEvent(ABANDONED_EVENT_NAME, clientId, sessionId),
      restricted: { device_information: { encoded: "test encoded header" } },
    });
  });
});
