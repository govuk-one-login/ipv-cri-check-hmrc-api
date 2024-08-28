import { stackOutputs } from "../../resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  getItemByKey,
} from "../../resources/dynamodb-helper";
import {
  authorizationEndpoint,
  checkEndpoint,
  createSession,
} from "../endpoints";
import { CLIENT_ID, CLIENT_URL, NINO } from "../env-variables";

jest.setTimeout(30000);

describe("Given the session is invalid and expecting it not to be authorized", () => {
  let authCode: any;
  let sessionId: string;
  let state: string;
  let personIDTableName: string;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
  }>;
  let sessionTableName: string;

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;

    const session = await createSession();
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    state = sessionData.state;
    await checkEndpoint({ "session-id": sessionId }, NINO);
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

  it("Should return an 400 response when /authorization endpoint is called when session id is empty", async () => {
    const authResponse = await authorizationEndpoint(
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
        sessionId,
        CLIENT_ID,
        `${CLIENT_URL}/callback`,
        ""
      );
      await authResponse.json();

      expect(authResponse.status).toEqual(400);

    });
});
