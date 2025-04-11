import { stackOutputs } from "../../resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  getItemByKey,
} from "../../resources/dynamodb-helper";
import {
  abandonEndpoint,
  authorizationEndpoint,
  checkEndpoint,
  createSession,
  getJarAuthorization,
} from "../endpoints";
import { CLIENT_ID, CLIENT_URL, NINO } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session is valid and expecting to abandon the journey", () => {
  let sessionId: string;
  let sessionTableName: string;
  let state: string;
  let privateApi: string;

  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
    PrivateApiGatewayId: string;
  }>;

  let commonStack: string;

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    commonStack = `${output.CommonStackName}`;
    sessionTableName = `session-${commonStack}`;
  });

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();
    privateApi = `${output.PrivateApiGatewayId}`;
    const session = await createSession(privateApi, request);
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    state = sessionData.state;
    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
    await authorizationEndpoint(
      privateApi,
      sessionId,
      CLIENT_ID,
      `${CLIENT_URL}/callback`,
      state
    );
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `person-identity-${commonStack}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: `${output.NinoUsersTable}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${output.UserAttemptsTable}`);
  });

  it("Should receive a 200 response when /abandon endpoint is called without optional headers", async () => {
    const abandonResponse = await abandonEndpoint(privateApi, {
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
  });
});
