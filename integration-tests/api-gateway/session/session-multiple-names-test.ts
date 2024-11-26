import { createMultipleNamesSession } from "../endpoints";
import { clearItemsFromTables } from "../../resources/dynamodb-helper";
describe("Given the session is valid", () => {
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

  it("Should receive a valid session id when /session endpoint is called", async () => {
    const sessionResponse = await createMultipleNamesSession();
    const jsonSession = await sessionResponse.json();
    sessionId = jsonSession.session_id;

    expect(sessionId).toBeDefined();
    expect(sessionResponse.status).toEqual(201);
  });
});
