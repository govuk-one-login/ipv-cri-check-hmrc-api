import { createPayload, createSession } from "../endpoints";
import { clearItemsFromTables } from "../../resources/dynamodb-helper";
import { stackOutputs } from "../../resources/cloudformation-helper";

jest.setTimeout(30000);
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
    const payload = await createPayload();
    const preOutput = await stackOutputs(process.env.STACK_NAME);
    const privateApi = `${preOutput.PrivateApiGatewayId}`;
    const sessionResponse = await createSession(privateApi, payload);

    const jsonSession = await sessionResponse.json();
    sessionId = jsonSession.session_id;

    expect(sessionId).toBeDefined();
    expect(sessionResponse.status).toEqual(201);
  });
});
