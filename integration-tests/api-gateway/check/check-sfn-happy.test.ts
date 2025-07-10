import { checkEndpoint, createSession, getJarAuthorization } from "../endpoints";
import { clearAttemptsTable, clearItemsFromTables } from "../../resources/dynamodb-helper";
import { AUDIENCE, NINO } from "../env-variables";

jest.setTimeout(30_000);

describe("Given the session and NINO is valid", () => {
  let sessionId: string;
  let sessionData: { session_id: string };
  let sessionTableName: string;
  let privateApi: string;
  let issuer: string | undefined;

  beforeEach(async () => {
    const data = await getJarAuthorization();
    const request = await data.json();
    privateApi = `${process.env.PRIVATE_API}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    const session = await createSession(privateApi, request);
    sessionData = await session.json();
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: `${process.env.NINO_USERS_TABLE}`,
        items: { sessionId: sessionId },
      },
      {
        tableName: sessionTableName,
        items: { sessionId: sessionId },
      }
    );
    await clearAttemptsTable(sessionId, `${process.env.USERS_ATTEMPTS_TABLE}`);
  });

  it("Should receive a 200 response when /check endpoint is called without optional headers", async () => {
    sessionId = sessionData.session_id;

    const check = await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
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

    const data = await getJarAuthorization({
      aud: AUDIENCE,
      iss: issuer,
      claimsOverride: multipleNamesSession,
    });

    const request = await data.json();
    const sessionResponse = await createSession(privateApi, request);
    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.session_id;

    const check = await checkEndpoint(privateApi, { "session-id": sessionId }, NINO);
    const checkData = check.status;

    expect(checkData).toEqual(200);
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
