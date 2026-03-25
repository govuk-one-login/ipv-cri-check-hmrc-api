import { beforeEach, describe, expect, it, vi } from "vitest";
const mockDynamoClient = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
vi.mock("../../open-telemetry/src/otel-setup");
vi.mock("../src/helpers/write-completed-check");
vi.mock("../src/helpers/function-config");
vi.mock("../src/helpers/nino");
vi.mock("../../common/src/config/get-hmrc-config");
vi.mock("../../common/src/database/get-attempts");
vi.mock("../../common/src/database/get-record-by-session-id");
vi.mock("../../common/src/hmrc-apis/pdv");
vi.mock("../../common/src/hmrc-apis/otg");
vi.mock("@govuk-one-login/cri-metrics");
vi.mock("@govuk-one-login/cri-audit");
vi.mock("../../common/src/util/dynamo", () => ({
  dynamoDBClient: mockDynamoClient,
}));

import { mockOtgToken, mockPdvRes } from "./mocks/mockData";
import { mockNino, mockPersonIdentity, mockSession, mockSessionId } from "../../common/tests/mocks/mockData";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { mockDeviceInformationHeader, mockFunctionConfig, mockHmrcConfig } from "./mocks/mockConfig";
import { mockLogger } from "../../common/tests/logger";

import { handler } from "../src/handler";
import { NinoCheckFunctionConfig } from "../src/helpers/function-config";
import { getHmrcConfig } from "../../common/src/config/get-hmrc-config";
import { handleResponseAndSaveAttempt, saveTxn } from "../src/helpers/nino";
import { callPdvMatchingApi } from "../../common/src/hmrc-apis/pdv";
import { writeCompletedCheck } from "../src/helpers/write-completed-check";
import { getTokenFromOtg } from "../../common/src/hmrc-apis/otg";
import { buildPdvInput } from "../src/helpers/build-pdv-input";
import { captureMetric } from "@govuk-one-login/cri-metrics";
import { CriError } from "@govuk-one-login/cri-error-response";
import { getAttempts as attempts } from "../../common/src/database/get-attempts";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { buildAndSendAuditEvent } from "@govuk-one-login/cri-audit";
import { AUDIT_EVENT_TYPE } from "../../common/src/types/audit";
import type { AttemptItem } from "../../common/src/types/attempt";

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

const handlerInput: Parameters<typeof handler> = [
  {
    headers: {
      "session-id": mockSessionId,
      "txma-audit-encoded": mockDeviceInformationHeader,
    },
    body: JSON.stringify({
      nino: mockNino,
    }),
  } as unknown as APIGatewayProxyEvent,
  mockContext,
];

vi.mocked(NinoCheckFunctionConfig).mockImplementation(function () { return mockFunctionConfig; });
vi.mocked(getSessionBySessionId).mockResolvedValue(mockSession);
vi.mocked(getHmrcConfig).mockResolvedValue(mockHmrcConfig);
vi.mocked(attempts).mockResolvedValue({ count: 0, items: [] });
vi.mocked(getRecordBySessionId).mockResolvedValue(mockPersonIdentity);
vi.mocked(getTokenFromOtg).mockResolvedValue(mockOtgToken);
vi.mocked(callPdvMatchingApi).mockResolvedValue(mockPdvRes);
vi.mocked(handleResponseAndSaveAttempt).mockResolvedValue(true);

describe("nino-check handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executes successfully with a valid input", async () => {
    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });

    expect(NinoCheckFunctionConfig).toHaveBeenCalled();
    expect(mockLogger.appendKeys).toHaveBeenCalledWith({
      govuk_signin_journey_id: mockSession.clientSessionId,
    });
    expect(buildAndSendAuditEvent).toHaveBeenCalledWith(mockFunctionConfig.audit.queueUrl, AUDIT_EVENT_TYPE.REQUEST_SENT, mockFunctionConfig.audit.componentId, mockSession, {
      restricted: {
        birthDate: mockPersonIdentity.birthDates,
        name: mockPersonIdentity.names,
        socialSecurityRecord: [{ personalNumber: mockNino }],
        device_information: {
          encoded: mockDeviceInformationHeader,
        },
      },
    });
    expect(callPdvMatchingApi).toHaveBeenCalledWith(
      mockHmrcConfig.pdv,
      mockOtgToken,
      buildPdvInput(mockPersonIdentity, mockNino)
    );
    expect(saveTxn).toHaveBeenCalledWith(
      mockDynamoClient,
      mockFunctionConfig.tableNames.sessionTable,
      mockSessionId,
      mockPdvRes.txn
    );
    expect(buildAndSendAuditEvent).toHaveBeenCalledWith(mockFunctionConfig.audit.queueUrl, AUDIT_EVENT_TYPE.RESPONSE_RECEIVED, mockFunctionConfig.audit.componentId, mockSession, {
      restricted: {
        device_information: {
          encoded: mockDeviceInformationHeader,
        },
      },
      extensions: {
        evidence: {
          txn: mockPdvRes.txn,
        },
      },
    });
    expect(handleResponseAndSaveAttempt).toHaveBeenCalledWith(
      mockDynamoClient,
      mockFunctionConfig.tableNames.attemptTable,
      mockSession,
      mockPdvRes
    );
    expect(writeCompletedCheck).toHaveBeenCalledWith(
      mockDynamoClient,
      mockFunctionConfig.tableNames,
      mockSession,
      mockNino
    );
  });

  it("handles application errors correctly", async () => {
    vi.mocked(getSessionBySessionId).mockImplementationOnce(() => {
      throw new Error("nooooooo!!!");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(NinoCheckFunctionConfig).toHaveBeenCalled();
    expect(getSessionBySessionId).toHaveBeenCalledWith(mockFunctionConfig.tableNames.sessionTable, mockSessionId);
    expect(getHmrcConfig).not.toHaveBeenCalled();
  });

  it("handles a too-many-attempts scenario correctly", async () => {
    vi.mocked(attempts).mockResolvedValueOnce({ count: 2, items: [{}, {}] as unknown[] as AttemptItem[] });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });

    expect(mockLogger.appendKeys).toHaveBeenCalledWith({
      govuk_signin_journey_id: mockSession.clientSessionId,
    });
    expect(attempts).toHaveBeenCalled();
    expect(captureMetric).toHaveBeenCalledWith("AttemptsExceededMetric");
    expect(getRecordBySessionId).not.toHaveBeenCalled();
  });

  it("handles a problem with the PDV function correctly", async () => {
    vi.mocked(callPdvMatchingApi).mockImplementationOnce(() => {
      throw new Error("broken!");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Error"));
    expect(saveTxn).not.toHaveBeenCalled();
  });

  it("behaves correctly if ninoMatch is false", async () => {
    vi.mocked(handleResponseAndSaveAttempt).mockResolvedValueOnce(false);

    const response = await handler(
      { ...handlerInput[0], headers: { ...handlerInput[0].headers, "txma-audit-encoded": undefined } },
      handlerInput[1]
    );

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: true }),
    });

    expect(writeCompletedCheck).not.toHaveBeenCalled();
    expect(captureMetric).toHaveBeenCalledWith("RetryAttemptsSentMetric");
  });

  it("should return 200 if nino match is false but it's the final attempt", async () => {
    vi.mocked(attempts).mockResolvedValueOnce({ count: 1, items: [{}] as unknown[] as AttemptItem[] });
    vi.mocked(handleResponseAndSaveAttempt).mockResolvedValueOnce(false);

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });
  });

  it("should return 500 if unexpected Error recieved from PDV request", async () => {
    vi.mocked(handleResponseAndSaveAttempt).mockImplementationOnce(() => {
      throw new CriError(500, "Error");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(writeCompletedCheck).not.toHaveBeenCalled();
  });
});
