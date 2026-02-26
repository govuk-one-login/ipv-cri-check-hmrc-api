import { ninoCheckEndpoint, createSession, getJarAuthorization } from "../endpoints";
import { clearAttemptsTable, clearItemsFromTables } from "../../resources/dynamodb-helper";
import { AUDIENCE, NINO } from "../env-variables";
import {
  NinoCheckAuditExtensions,
  baseExpectedEvent,
  REQUEST_SENT_EVENT_NAME,
  RESPONSE_RECEIVED_EVENT_NAME,
  NinoCheckAuditRestricted,
  TEST_HARNESS_EXECUTE_URL,
} from "../audit";
import { testUser } from "../user";
import { AuditEvent } from "@govuk-one-login/cri-audit";
import { pollTestHarnessForEvents } from "@govuk-one-login/cri-test-resources-helpers";

jest.setTimeout(60_000); // 1 min

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

    const check = await ninoCheckEndpoint(privateApi, { "session-id": sessionId }, NINO);

    const resBody = { ...(await check.json()) };

    expect(check.status).toEqual(200);
    expect(resBody).toStrictEqual({ requestRetry: false });

    const reqSentEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, REQUEST_SENT_EVENT_NAME, sessionId);
    expect(reqSentEvents).toHaveLength(1);

    const expectedRequestSentAuditEvent: AuditEvent<never, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(REQUEST_SENT_EVENT_NAME, sessionId),
      restricted: {
        birthDate: [{ value: testUser.dob }],
        name: testUser.formattedName,
        socialSecurityRecord: [{ personalNumber: NINO }],
      }
    };
    expect(reqSentEvents[0].event).toStrictEqual(expectedRequestSentAuditEvent);

    const resReceivedEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, RESPONSE_RECEIVED_EVENT_NAME, sessionId);
    expect(resReceivedEvents).toHaveLength(1);
    const expectedResponseReceivedAuditEvent: AuditEvent<NinoCheckAuditExtensions, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(RESPONSE_RECEIVED_EVENT_NAME, sessionId),
      extensions: {
        evidence: { txn: expect.any(String) },
      }
    }
    expect(resReceivedEvents[0].event).toStrictEqual(expectedResponseReceivedAuditEvent);
  });

  it("Should receive a 200 response when /check endpoint is called with optional headers", async () => {
    sessionId = sessionData.session_id;

    const check = await ninoCheckEndpoint(
      privateApi,
      { "session-id": sessionId, "txma-audit-encoded": "test encoded header" },
      NINO
    );

    const resBody = { ...(await check.json()) };

    expect(check.status).toEqual(200);
    expect(resBody).toStrictEqual({ requestRetry: false });

    const reqSentEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, REQUEST_SENT_EVENT_NAME, sessionId);
    expect(reqSentEvents).toHaveLength(1);

    const expectedRequestSentAuditEvent: AuditEvent<never, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(REQUEST_SENT_EVENT_NAME, sessionId),
      restricted: {
        birthDate: [{ value: testUser.dob }],
        name: testUser.formattedName,
        socialSecurityRecord: [{ personalNumber: NINO }],
        device_information: {
          encoded: "test encoded header",
        }
      }
    }
    expect(reqSentEvents[0].event).toStrictEqual(expectedRequestSentAuditEvent);

    const resReceivedEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, RESPONSE_RECEIVED_EVENT_NAME, sessionId);
    expect(resReceivedEvents).toHaveLength(1);

    const expectedRequestReceivedAuditEvent: AuditEvent<NinoCheckAuditExtensions, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(RESPONSE_RECEIVED_EVENT_NAME, sessionId),
      restricted: {
        device_information: {
          encoded: "test encoded header",
        },
      },
      extensions: {
        evidence: { txn: expect.any(String) },
      }
    }
    expect(resReceivedEvents[0].event).toStrictEqual(expectedRequestReceivedAuditEvent);
  });

  it("Should request retry when NINo match fails", async () => {
    const deceasedPersonSession = {
      name: [
        {
          nameParts: [
            {
              value: "Error",
              type: "GivenName",
            },
            {
              value: "Deceased",
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
      claimsOverride: deceasedPersonSession,
    });

    const request = await data.json();
    const sessionResponse = await createSession(privateApi, request);
    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.session_id;

    const check = await ninoCheckEndpoint(
      privateApi,
      { "session-id": sessionId, "txma-audit-encoded": "test encoded header" },
      NINO
    );

    const resBody = { ...(await check.json()) };

    expect(check.status).toEqual(200);
    expect(resBody).toStrictEqual({ requestRetry: true });

    const reqSentEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, REQUEST_SENT_EVENT_NAME, sessionId);
    expect(reqSentEvents).toHaveLength(1);

    const expectedRequestSentAuditEvent: AuditEvent<never, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(REQUEST_SENT_EVENT_NAME, sessionId),
      restricted: {
        birthDate: deceasedPersonSession.birthDate,
        name: deceasedPersonSession.name,
        socialSecurityRecord: [{ personalNumber: NINO }],
        device_information: {
          encoded: "test encoded header",
        },
      },
    }
    expect(reqSentEvents[0].event).toStrictEqual(expectedRequestSentAuditEvent);

    const resReceivedEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, RESPONSE_RECEIVED_EVENT_NAME, sessionId);
    expect(resReceivedEvents).toHaveLength(1);

    const expectedRequestReceivedAuditEvent: AuditEvent<NinoCheckAuditExtensions, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(RESPONSE_RECEIVED_EVENT_NAME, sessionId),
      restricted: {
        device_information: {
          encoded: "test encoded header",
        },
      },
      extensions: {
        evidence: { txn: expect.any(String) },
      }
    }
    expect(resReceivedEvents[0].event).toStrictEqual(expectedRequestReceivedAuditEvent);
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

    const check = await ninoCheckEndpoint(privateApi, { "session-id": sessionId }, NINO);
    const checkData = check.status;

    expect(checkData).toEqual(200);

    const reqSentEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, REQUEST_SENT_EVENT_NAME, sessionId);
    expect(reqSentEvents).toHaveLength(1);

    const expectedRequestSentAuditEvent: AuditEvent<never, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(REQUEST_SENT_EVENT_NAME, sessionId),
      restricted: {
        birthDate: [{ value: "2000-02-02" }],
        name: multipleNamesSession.name,
        socialSecurityRecord: [{ personalNumber: NINO }],
      }
    }
    expect(reqSentEvents[0].event).toStrictEqual(expectedRequestSentAuditEvent);

    const resReceivedEvents = await pollTestHarnessForEvents(TEST_HARNESS_EXECUTE_URL, RESPONSE_RECEIVED_EVENT_NAME, sessionId);
    expect(resReceivedEvents).toHaveLength(1);

    const expectedRequestReceivedAuditEvent: AuditEvent<NinoCheckAuditExtensions, never, NinoCheckAuditRestricted> = {
      ...baseExpectedEvent(RESPONSE_RECEIVED_EVENT_NAME, sessionId),
      extensions: {
        evidence: { txn: expect.any(String) },
      }
    }
    expect(resReceivedEvents[0].event).toStrictEqual(expectedRequestReceivedAuditEvent);
  });
});
