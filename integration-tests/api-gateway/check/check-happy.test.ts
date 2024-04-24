import { checkEndpoint, createSession } from "../endpoints";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../step-functions/aws/resources/dynamodb-helper";
import { NINO } from "../env-variables";
import { stackOutputs } from "../../step-functions/aws/resources/cloudformation-helper";

jest.setTimeout(30000);

describe("Private API Happy Path Tests", () => {
  let sessionId: string;
  let personIDTableName: string;
  let sessionTableName: string;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
  }>;

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

  it("Check API", async () => {
    const session = await createSession();
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    const check = await checkEndpoint(sessionId, NINO);
    const checkData = check.status;
    expect(checkData).toEqual(200);
  });
});
