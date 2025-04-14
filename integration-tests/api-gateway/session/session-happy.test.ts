import { createSession, getJarAuthorization } from "../endpoints";
import { clearItemsFromTables } from "../../resources/dynamodb-helper";
import { stackOutputs } from "../../resources/cloudformation-helper";

jest.setTimeout(30_000);
describe("Given the session is valid", () => {
  let sessionId: string;
  let jsonSession: { session_id: string };
  let sessionResponse: Response;

  let output: Partial<{
    CommonStackName: string;
    PrivateApiGatewayId: string;
  }>;

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
  });

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();

    const privateApi = `${output.PrivateApiGatewayId}`;

    sessionResponse = await createSession(privateApi, request);
    jsonSession = await sessionResponse.json();
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `person-identity-${output.CommonStackName}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: `session-${output.CommonStackName}`,
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
