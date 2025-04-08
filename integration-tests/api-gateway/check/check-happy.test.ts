import { checkEndpoint, createPayload, createSession } from "../endpoints";
import {
  clearAttemptsTable,
  clearItemsFromTables,
} from "../../resources/dynamodb-helper";
import { NINO } from "../env-variables";
import { stackOutputs } from "../../resources/cloudformation-helper";

jest.setTimeout(30000);

describe("Given the session and NINO is valid", () => {
  let sessionId: string;
  let personIDTableName: string;
  let sessionTableName: string;
  let output: Partial<{
    CommonStackName: string;
    StackName: string;
    NinoUsersTable: string;
    UserAttemptsTable: string;
    PrivateApiGatewayId: string;
  }>;

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

  it("Should receive a 200 response when /check endpoint is called without optional headers", async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    const payload = await createPayload();
    const privateApi = `${output.PrivateApiGatewayId}`;
    const session = await createSession(privateApi, payload);
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    const check = await checkEndpoint(
      privateApi,
      { "session-id": sessionId },
      NINO
    );
    const checkData = check.status;
    expect(checkData).toEqual(200);
  });

  it("Should receive a 200 response when /check endpoint is called with optional headers", async () => {
    const payload = await createPayload();
    const privateApi = `${output.PrivateApiGatewayId}`;
    const session = await createSession(privateApi, payload);
    const sessionData = await session.json();
    sessionId = sessionData.session_id;
    const check = await checkEndpoint(
      privateApi,
      { "session-id": sessionId, "txma-audit-encoded": "test encoded header" },
      NINO
    );
    const checkData = check.status;
    expect(checkData).toEqual(200);
  });

  it("Should receive a 200 response when /check endpoint is called using multiple named user", async () => {
    const privateApi = `${output.PrivateApiGatewayId}`;

    const multipleNamesSession = await createPayload({
      name: [
        {
          nameParts: [
            { type: "GivenName", value: "Peter" },
            { type: "GivenName", value: "Syed Habib" },
            { type: "FamilyName", value: "Martin-Joy" },
          ],
        },
      ],
    });
    const sessionResponse = await createSession(
      privateApi,
      multipleNamesSession
    );
    const sessionData = await sessionResponse.json();
    sessionId = sessionData.session_id;
    const check = await checkEndpoint(
      `${output.PrivateApiGatewayId}`,
      { "session-id": sessionId },
      NINO
    );
    const checkData = check.status;
    expect(checkData).toEqual(200);
  });

  it("should 500 when provided with JS in the session header", async () => {
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
    const payload = await createPayload();
    const privateApi = `${output.PrivateApiGatewayId}`;
    const session = await createSession(privateApi, payload);
    const sessionData = await session.json();
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
