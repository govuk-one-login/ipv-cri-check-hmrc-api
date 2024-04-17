import { checkEndpoint, createSession } from "../../endpoints";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../../step-functions/aws/resources/dynamodb-helper";
import { nino } from "../env-variables";

jest.setTimeout(30000);

describe("Private API Happy Path Tests", () => {
  let sessionId: any;

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: "person-identity-common-cri-api",
        items: { sessionId: sessionId },
      },
      {
        tableName:
          "preview-check-hmrc-api-oj-2484-happy-path-api-tests-nino-users",
        items: { sessionId: sessionId },
      },
      {
        tableName: "session-common-cri-api",
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(
      sessionId,
      "preview-check-hmrc-api-oj-2484-happy-path-api-tests-user-attempts"
    );
  });

  it("Check API", async () => {
    const session = await createSession();
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    const check = await checkEndpoint(sessionId, nino);
    const checkData = check.status;
    expect(checkData).toEqual(200);
  });
});
