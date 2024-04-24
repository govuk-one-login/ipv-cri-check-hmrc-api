import { createSession } from "../endpoints";
import { clearItemsFromTables } from "../../step-functions/aws/resources/dynamodb-helper";
describe("Private API Happy Path Tests", () => {
  let sessionId: string;

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: "person-identity-common-cri-api",
        items: { sessionId: sessionId },
      },
      {
        tableName: "session-common-cri-api",
        items: { sessionId: sessionId },
      }
    );
  });

  it("Session API", async () => {
    const sessionResponse = await createSession();
    const jsonSession = await sessionResponse.json();
    sessionId = jsonSession.session_id;

    expect(sessionId).toBeDefined();
    expect(sessionResponse.status).toEqual(201);
  });
});
