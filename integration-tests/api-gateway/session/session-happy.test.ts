import { createSession, getJarAuthorization } from "../endpoints";
import { clearItemsFromTables } from "../../resources/dynamodb-helper";
import { stackOutputs } from "../../resources/cloudformation-helper";
import { getSSMParameters } from "../../resources/ssm-param-helper";

const clientId = "ipv-core-stub-aws-headless";

jest.setTimeout(30000);
describe("Given the session is valid", () => {
  let sessionId: string;
  let audience: string | undefined;
  let issuer: string | undefined;
  let jsonSession: { session_id: string };
  let sessionResponse: Response;

  beforeAll(async () => {
    const { CommonStackName: commonStack } = await stackOutputs(
      process.env.STACK_NAME
    );

    [audience, issuer] = await getSSMParameters(
      `/${commonStack}/clients/${clientId}/jwtAuthentication/audience`,
      `/${commonStack}/clients/${clientId}/jwtAuthentication/issuer`
    );
  });

  beforeEach(async () => {
    const data = await getJarAuthorization(clientId, audience, issuer);
    const request = await data.json();

    const outputs = await stackOutputs(process.env.STACK_NAME);
    const privateApi = `${outputs.PrivateApiGatewayId}`;

    sessionResponse = await createSession(privateApi, request);
    jsonSession = await sessionResponse.json();
  });
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
    sessionId = jsonSession.session_id;

    expect(sessionId).toBeDefined();
    expect(sessionResponse.status).toEqual(201);
  });
});
