import { stackOutputs } from "../../resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import {
  authorizationEndpoint,
  checkEndpoint,
  createSession,
  getJarAuthorization,
} from "../endpoints";
import { CLIENT_ID, NINO, REDIRECT_URL } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session is invalid and expecting it not to be authorized", () => {
  let sessionId: string;
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

    privateApi = `${output.PrivateApiGatewayId}`;
  });

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();
    const session = await createSession(privateApi, request);
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    state = sessionData.state;
    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
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
        tableName: `session-${commonStack}`,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${output.UserAttemptsTable}`);
  });

  it("Should return an 400 response when /authorization endpoint is called when session id is empty", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      "",
      CLIENT_ID,
      REDIRECT_URL,
      state
    );
    await authResponse.json();

    expect(authResponse.status).toEqual(400);
  });

  it("Should return an 400 response when /authorization endpoint is called when client id is empty", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      sessionId,
      "",
      REDIRECT_URL,
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
      REDIRECT_URL,
      ""
    );
    await authResponse.json();

    expect(authResponse.status).toEqual(200);
  });
});
