import { stackOutputs } from "../../../step-functions/aws/resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  getItemByKey,
} from "../../../step-functions/aws/resources/dynamodb-helper";
import {
  abandonEndpoint,
  authorizationEndpoint,
  checkEndpoint,
  createSession,
} from "../../endpoints";
import { CLIENT_ID, CLIENT_URL, nino } from "../env-variables";

jest.setTimeout(30000);

describe("Private API Happy Path Tests", () => {
  let sessionId: string;
  let sessionTableName: string;
  let state: string;
  let personIDTableName: string;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
  }>;

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;

    const session = await createSession();
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    state = sessionData.state;
    await checkEndpoint(sessionId, nino);
    await authorizationEndpoint(sessionId, CLIENT_ID, `${CLIENT_URL}/callback`, state);
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

  it("Abandon API", async () => {
    const abandonResponse = await abandonEndpoint(sessionId);
    expect(abandonResponse.status).toEqual(200);

    const sessionRecord = await getItemByKey(sessionTableName, {
      sessionId: sessionId,
    });

    //Checking DynamoDB to ensure authCode is displayed
    expect(sessionRecord.Item?.authorizationCode).toBeUndefined();
    expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBe(0);
  });
});
