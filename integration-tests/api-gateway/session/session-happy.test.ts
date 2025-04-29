import { createSession, getJarAuthorization } from "../endpoints";
import { clearItemsFromTables } from "../../resources/dynamodb-helper";

jest.setTimeout(30_000);
describe("Given the session is valid", () => {
  let sessionId: string;
  let sessionTableName: string;
  let jsonSession: { session_id: string };
  let sessionResponse: Response;

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();
    const privateApi = `${process.env.PRIVATE_API}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;

    sessionResponse = await createSession(privateApi, request);
    jsonSession = await sessionResponse.json();
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId: sessionId },
      }
    );
  });

  it("Should receive a valid session id when /session endpoint is called", async () => {
    sessionId = jsonSession.session_id;

    expect(sessionId).toBeDefined();
    expect(sessionResponse.status).toEqual(201);
  });
});
