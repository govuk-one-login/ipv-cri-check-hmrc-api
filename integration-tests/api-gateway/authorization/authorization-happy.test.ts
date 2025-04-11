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

jest.setTimeout(30000);

describe("Given the session is valid and expecting to be authorized", () => {
  let authCode: { value: string };
  let sessionId: string;
  let state: string;
  let personIDTableName: string;
  let privateApi: string;
  let audience: string | undefined;
  let issuer: string | undefined;
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

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    const commonStack = output.CommonStackName;
    sessionTableName = `session-${output.CommonStackName}`;

    privateApi = `${output.PrivateApiGatewayId}`;

    [audience, issuer, redirectUri] = await getSSMParameters(
      `/${commonStack}/clients/${clientId}/jwtAuthentication/audience`,
      `/${commonStack}/clients/${clientId}/jwtAuthentication/issuer`,
      `/${commonStack}/clients/${clientId}/jwtAuthentication/redirectUri`
    );
  });

  beforeEach(async () => {
    const data = await getJarAuthorization(clientId, audience, issuer);
    const request = await data.json();
    const session = await createSession(privateApi, request);
    const sessionData = await session.json();

    sessionId = sessionData.session_id;
    state = sessionData.state;

    await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
  });

  afterEach(async () => {
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
