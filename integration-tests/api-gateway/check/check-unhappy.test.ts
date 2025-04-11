import {
  checkEndpoint,
  createSession,
  getJarAuthorization,
} from "../endpoints";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import { NINO } from "../env-variables";
import { stackOutputs } from "../../resources/cloudformation-helper";
import { getSSMParameters } from "../../resources/ssm-param-helper";

jest.setTimeout(30000);

describe("Given the session and NINO is invalid", () => {
  let sessionId: string;
  let privateApi: string;
  let personIDTableName: string;
  let sessionTableName: string;
  let sessionData: { session_id: string };
  let audience: string | undefined;
  let issuer: string | undefined;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
    PrivateApiGatewayId: string;
  }>;
  const clientId = "ipv-core-stub-aws-headless";

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    const commonStack = output.CommonStackName;
    sessionTableName = `session-${output.CommonStackName}`;

    [audience, issuer] = await getSSMParameters(
      `/${commonStack}/clients/${clientId}/jwtAuthentication/audience`,
      `/${commonStack}/clients/${clientId}/jwtAuthentication/issuer`
    );
  });

  beforeEach(async () => {
    const data = await getJarAuthorization(clientId, audience, issuer);
    const request = await data.json();

    privateApi = `${output.PrivateApiGatewayId}`;
    const session = await createSession(privateApi, request);
    sessionData = await session.json();
  });

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

  it("Should receive a 400 response when /check endpoint is called without session id value and optional header", async () => {
    sessionId = sessionData.session_id;

    const check = await checkEndpoint(privateApi, {}, NINO);
    const checkData = check.status;
    expect(checkData).toEqual(400);
  });

  it("Should receive a 500 response when /check endpoint is called without NiNo", async () => {
    sessionId = sessionData.session_id;
    const check = await checkEndpoint(
      privateApi,
      { "session-id": sessionId, "txma-audit-encoded": "test encoded header" },
      ""
    );
    const checkData = check.status;
    expect(checkData).toEqual(500);
  });

  it("should 500 when provided with JS in the session header", async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    const maliciousSessionId = `<script>alert('Attack!');</script>`;
    const check = await checkEndpoint(
      `${output.PrivateApiGatewayId}`,
      {
        "session-id": maliciousSessionId,
        "txma-audit-encoded": "test encoded header",
      },
      NINO
    );
    expect(check.status).toEqual(500);
  });

  it("should 500 when provided with JS as a nino", async () => {
    const maliciousNino = `<script>alert('Attack!');</script>`;
    const check = await checkEndpoint(
      privateApi,
      {
        "session-id": sessionData.session_id,
        "txma-audit-encoded": "test encoded header",
      },
      maliciousNino
    );
    expect(check.status).toEqual(500);
  });
});
