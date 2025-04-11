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

describe("Given the session and NINO is valid", () => {
  let sessionId: string;
  let sessionData: { session_id: string };
  let personIDTableName: string;
  let sessionTableName: string;
  let privateApi: string;
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

    privateApi = `${output.PrivateApiGatewayId}`;

    [audience, issuer] = await getSSMParameters(
      `/${commonStack}/clients/${clientId}/jwtAuthentication/audience`,
      `/${commonStack}/clients/${clientId}/jwtAuthentication/issuer`
    );
  });
  beforeEach(async () => {
    const data = await getJarAuthorization(clientId, audience, issuer);
    const request = await data.json();

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

  it("Should receive a 200 response when /check endpoint is called without optional headers", async () => {
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
    sessionId = sessionData.session_id;

    const check = await checkEndpoint(
      privateApi,
      { "session-id": sessionId, "txma-audit-encoded": "test encoded header" },
      NINO
    );

    expect(check.status).toEqual(200);
  });

  it("Should receive a 200 response when /check endpoint is called using multiple named user", async () => {
    const privateApi = `${output.PrivateApiGatewayId}`;
    const multipleNamesSession = {
      name: [
        {
          nameParts: [
            {
              value: "Peter",
              type: "GivenName",
            },
            {
              value: "Syed Habib",
              type: "GivenName",
            },
            {
              value: "Carvalho",
              type: "FamilyName",
            },
            {
              value: "Martin-Joy",
              type: "FamilyName",
            },
          ],
        },
      ],
      birthDate: [{ value: "2000-02-02" }],
      address: [
        {
          addressLocality: "LONDON",
          buildingNumber: "1",
          postalCode: "EE2 1AA",
          streetName: "Test st",
          validFrom: "2024-01-01",
        },
      ],
    };

    const data = await getJarAuthorization(
      clientId,
      audience,
      issuer,
      multipleNamesSession
    );

    const request = await data.json();
    const sessionResponse = await createSession(privateApi, request);
    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.session_id;

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
