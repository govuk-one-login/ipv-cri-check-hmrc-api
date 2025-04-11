import { stackOutputs } from "../../resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
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

describe("Given the session is invalid and expecting to abandon the journey", () => {
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
        tableName: `session-${commonStack}`,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${output.UserAttemptsTable}`);
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
