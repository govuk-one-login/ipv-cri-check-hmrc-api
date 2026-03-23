import { mockLogger } from "../../common/tests/logger";
import { mockDynamoClient } from "../../common/tests/mocks/mockDynamoClient";

vi.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
vi.mock("../../open-telemetry/src/otel-setup");
vi.mock("../../common/src/config/base-function-config");
vi.mock("../../common/src/database/get-attempts");
vi.mock("../../common/src/database/get-record-by-session-id");
vi.mock("../src/helpers/retrieve-session-by-access-token");
vi.mock("../src/helpers/retrieve-nino-user");
vi.mock("@govuk-one-login/cri-metrics", () => ({
  metrics: {
    logMetrics: vi.fn(() => () => {}),
  },
  captureMetric: vi.fn(),
}));
const { mockIssueCredConfig } = vi.hoisted(() => ({
  mockIssueCredConfig: {
    credentialIssuerEnv: {
      issuer: "bob",
      maxJwtTtl: 1000,
      jwtTtlUnit: "Hours",
      commonStackName: "big-stack",
    },
    tableNames: {
      sessionTable: "session-table",
      personIdentityTable: "person-identity-table",
      attemptTable: "attempt-table",
      ninoUserTable: "nino-user-table",
    },
    audit: {
      queueUrl: "cool-queuez.com",
      componentId: "https://check-hmrc-time.account.gov.uk",
    },
  },
}));
vi.mock("../src/config/function-config", () => ({
  IssueCredFunctionConfig: vi.fn().mockImplementation(function () { return mockIssueCredConfig; }),
}));
vi.mock("../src/vc/vc-builder");
vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "mock-uuid-123"),
}));
vi.mock("../src/vc/contraIndicator");
vi.mock("../src/evidence/evidence-creator");
vi.mock("@govuk-one-login/cri-audit");
vi.mock("../../common/src/util/date-time", () => ({
  toEpochSecondsFromNow: vi.fn(() => 1234567890),
  TimeUnits: { Hours: "Hours" },
}));
vi.mock("../../common/src/util/dynamo", () => ({
  dynamoDBClient: mockDynamoClient,
}));
import * as VcConfig from "../src/config/vc-config";
import { mockFunctionConfig } from "./mocks/mockConfig";

import {
  mockAccessToken,
  mockNinoUser,
  mockPersonIdentity,
  mockSession,
  mockSessionId,
} from "../../common/tests/mocks/mockData";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { handler } from "../src/handler";
import { retrieveSessionIdByAccessToken } from "../src/helpers/retrieve-session-by-access-token";
import { getAttempts } from "../../common/src/database/get-attempts";
import { retrieveNinoUser } from "../src/helpers/retrieve-nino-user";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { buildVerifiableCredential } from "../src/vc/vc-builder";
import { getHmrcContraIndicators } from "../src/vc/contraIndicator";
import * as AuditUtils from "@govuk-one-login/cri-audit";
import * as MetricsUtils from "@govuk-one-login/cri-metrics";
import { getAuditEvidence } from "../src/evidence/evidence-creator";
import { jwtSigner } from "../src/kms-signer/kms-signer";

vi.mocked(buildVerifiableCredential).mockReturnValue({} as unknown as ReturnType<typeof buildVerifiableCredential>);
vi.mocked(getHmrcContraIndicators).mockReturnValue([]);
vi.mocked(getAuditEvidence).mockReturnValue({ txn: "test-txn", type: "IdentityCheck", attemptNum: 1 });

const mockContext: Context = {
  awsRequestId: "",
  callbackWaitsForEmptyEventLoop: false,
  functionName: "",
  functionVersion: "",
  invokedFunctionArn: "",
  logGroupName: "",
  logStreamName: "",
  memoryLimitInMB: "",
  done(): void {},
  fail(): void {},
  getRemainingTimeInMillis(): number {
    return 0;
  },
  succeed(): void {},
};

const internalServerError = {
  statusCode: 500,
  body: JSON.stringify({ message: "Internal server error" }),
  headers: {
    "Content-Type": "application/json",
  }
};

const badRequest = {
  statusCode: 400,
  body: expect.any(String),
  headers: {
    "Content-Type": "application/json",
  }
};

const handlerInput: Parameters<typeof handler> = [
  {
    headers: {
      Authorization: `Bearer ${mockAccessToken}`,
    },
  } as unknown as APIGatewayProxyEvent,
  mockContext,
];

vi.mocked(retrieveSessionIdByAccessToken).mockResolvedValue(mockSessionId);
vi.mocked(getAttempts).mockResolvedValue({ count: 0, items: [] });
vi.mocked(getSessionBySessionId).mockResolvedValueOnce(mockSession);
vi.mocked(getRecordBySessionId).mockResolvedValueOnce(mockPersonIdentity);
vi.mocked(retrieveNinoUser).mockResolvedValue(mockNinoUser);

const sendAuditEventSpy = vi.spyOn(AuditUtils, "buildAndSendAuditEvent");
const signJwtSpy = vi.spyOn(jwtSigner, "signJwt");
const captureMetricSpy = vi.spyOn(MetricsUtils, "captureMetric");
const expectedJwt = "header.payload.signature";
describe("issue-credential handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signJwtSpy.mockResolvedValueOnce(expectedJwt);
    sendAuditEventSpy.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    vi.mocked(buildVerifiableCredential).mockReturnValueOnce({
      vc: {
        evidence: [{ txn: "test-txn", type: "IdentityCheck" }],
      },
    } as unknown as ReturnType<typeof buildVerifiableCredential>);
  });

  it("executes successfully with a valid input", async () => {
    const spyVcConfig = vi.spyOn(VcConfig, "getVcConfig").mockResolvedValue({
      contraIndicator: {
        errorMapping: ["mapping1", "mapping2"],
        reasonsMapping: [],
      },
      kms: { signingKeyId: "some-key-id" },
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      headers: {
        "Content-Type": "application/jwt",
      },
      body: expectedJwt,
    });
    expect(spyVcConfig).toHaveBeenCalledWith("big-stack");
    expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: mockSession.clientSessionId });
    expect(getAttempts).toHaveBeenCalledWith(
      mockFunctionConfig.tableNames.attemptTable,
      mockDynamoClient,
      mockSession.sessionId
    );
    expect(sendAuditEventSpy).toHaveBeenCalledTimes(2);
    expect(sendAuditEventSpy).toHaveBeenNthCalledWith(
      1,
      mockFunctionConfig.audit.queueUrl,
      "IPV_HMRC_RECORD_CHECK_CRI_VC_ISSUED",
      mockFunctionConfig.audit.componentId,
      mockSession,
      expect.objectContaining({
        restricted: {
          birthDate: mockPersonIdentity.birthDates,
          name: mockPersonIdentity.names,
          socialSecurityRecord: [
            {
              personalNumber: mockNinoUser.nino,
            },
          ],
        },
        extensions: {
          evidence: expect.any(Object),
        },
      })
    );
    expect(sendAuditEventSpy).toHaveBeenNthCalledWith(2,  mockFunctionConfig.audit.queueUrl, "IPV_HMRC_RECORD_CHECK_CRI_END", mockFunctionConfig.audit.componentId, mockSession);
    expect(captureMetricSpy).toHaveBeenCalledWith("VCIssuedMetric");
  });

  it("handles application errors correctly", async () => {
    vi.mocked(retrieveSessionIdByAccessToken).mockImplementationOnce(() => {
      throw new Error("nooooooo!!!");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(retrieveSessionIdByAccessToken).toHaveBeenCalledWith(
      mockFunctionConfig.tableNames.sessionTable,
      mockDynamoClient,
      `Bearer ${mockAccessToken}`
    );
    expect(getAttempts).not.toHaveBeenCalled();
  });

  it("handles a missing or malformed access token", async () => {
    const response1 = await handler({ headers: {} } as unknown as APIGatewayProxyEvent, mockContext);
    expect(response1).toStrictEqual(badRequest);

    const response2 = await handler(
      { headers: { Authorization: "Bearer" } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response2).toStrictEqual(badRequest);

    const response3 = await handler(
      { headers: { Authorization: "gimme the access" } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response3).toStrictEqual(badRequest);

    const response4 = await handler(
      { headers: { Authorization: "Bearer billybob " } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response4).toStrictEqual(badRequest);

    const response5 = await handler(
      { headers: { Authorization: "Bearer      billybob" } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response5).toStrictEqual(badRequest);

    expect(retrieveSessionIdByAccessToken).not.toHaveBeenCalled();
  });
});
