import { stackOutputs } from "../../resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import {
  abandonEndpoint,
  authorizationEndpoint,
  checkEndpoint,
  createPayload,
  createSession,
} from "../endpoints";
import { CLIENT_ID, CLIENT_URL, NINO } from "../env-variables";

jest.setTimeout(30000);

describe("Given the session is invalid and expecting to abandon the journey", () => {
  let sessionId: string;
  let sessionTableName: string;
  let state: string;
  let personIDTableName: string;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
    PrivateApiGatewayId: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    const payload = await createPayload();
    const privateApi = `${output.PrivateApiGatewayId}`;
    const session = await createSession(privateApi, payload);
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
    output = await stackOutputs(process.env.STACK_NAME);
    personIDTableName = `person-identity-${output.CommonStackName}`;
    sessionTableName = `session-${output.CommonStackName}`;

    await clearItemsFromTables(
      {
        tableName: personIDTableName,
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

  it("Should receive a 400 response when /abandon endpoint is called with invalid session id", async () => {
    const abandonResponse = await abandonEndpoint(
      `${output.PrivateApiGatewayId}`,
      {
        "session-id": "test",
      }
    );
    expect(abandonResponse.status).toEqual(400);
  });

  it("Should receive a 400 response when /abandon endpoint is called with no session id", async () => {
    const abandonResponse = await abandonEndpoint(
      `${output.PrivateApiGatewayId}`,
      {}
    );
    expect(abandonResponse.status).toEqual(400);
  });
});
