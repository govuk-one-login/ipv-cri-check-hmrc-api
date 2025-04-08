import { stackOutputs } from "../../resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  getItemByKey,
} from "../../resources/dynamodb-helper";
import { getSSMParameters } from "../../resources/ssm-param-helper";
import {
  authorizationEndpoint,
  checkEndpoint,
  createSession,
  getJarAuthorization,
} from "../endpoints";
import { NINO } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session is valid and expecting to be authorized", () => {
  let authCode: { value: string };
  let sessionId: string;
  let state: string;
  let privateApi: string;
  let redirectUri: string | undefined;

  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
    PrivateApiGatewayId: string;
  }>;

  let sessionTableName: string;

  const clientId = "ipv-core-stub-aws-headless";
  let commonStack: string;

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    commonStack = `${output.CommonStackName}`;
    sessionTableName = `session-${commonStack}`;

    privateApi = `${output.PrivateApiGatewayId}`;

    [redirectUri] = await getSSMParameters(
      `/${commonStack}/clients/${clientId}/jwtAuthentication/redirectUri`
    );
  });

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();
    const session = await createSession(privateApi, request);
    const sessionData = await session.json();

    sessionId = sessionData.session_id;
    state = sessionData.state;

    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `person-identity-${commonStack}`,
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

  it("Should return an authorizationCode when /authorization endpoint is called", async () => {
    const authResponse = await authorizationEndpoint(
      privateApi,
      sessionId,
      clientId,
      redirectUri as string,
      state
    );

    const authData = await authResponse.json();
    authCode = authData.authorizationCode;

    expect(authResponse.status).toEqual(200);
    expect(authCode).toBeDefined();

    const sessionRecord = await getItemByKey(sessionTableName, {
      sessionId: sessionId,
    });

    //Checking DynamoDB to ensure authCode is displayed
    expect(sessionRecord.Item?.authorizationCode).toEqual(authCode.value);
    expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBeDefined();
  });
});
