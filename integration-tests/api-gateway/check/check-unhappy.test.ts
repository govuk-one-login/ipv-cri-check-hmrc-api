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

jest.setTimeout(30_000);

describe("Given the session and NINO is invalid", () => {
  let sessionId: string;
  let privateApi: string;
  let sessionData: { session_id: string };

  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
    PrivateApiGatewayId: string;
  }>;
  let commonStack: string;

  beforeAll(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    commonStack = `${output.CommonStackName}`;
  });

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();

    privateApi = `${output.PrivateApiGatewayId}`;
    const session = await createSession(privateApi, request);
    sessionData = await session.json();
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
        tableName: `session-${commonStack}`,
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
    const maliciousSessionId = `<script>alert('Attack!');</script>`;
    const check = await checkEndpoint(
      privateApi,
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
