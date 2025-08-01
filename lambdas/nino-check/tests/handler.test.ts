jest.mock("../../common/src/util/logger", () => ({
  logger: mockLogger,
}));
jest.mock("../src/helpers/write-completed-check");
jest.mock("../src/helpers/audit");
jest.mock("../src/helpers/function-config");
jest.mock("../src/helpers/nino");
jest.mock("../../common/src/database/get-attempts");
jest.mock("../../common/src/database/get-record-by-session-id");
jest.mock("../src/hmrc-apis/pdv");
jest.mock("../src/hmrc-apis/otg");
jest.mock("../../common/src/util/metrics");
jest.mock("../../common/src/util/audit");

import { mockDynamoClient } from "../../common/tests/mocks/mockDynamoClient";
import { mockOtgToken, mockPdvRes } from "./mocks/mockData";
import { mockNino, mockPersonIdentity, mockSession, mockSessionId } from "../../common/tests/mocks/mockData";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { mockDeviceInformationHeader, mockFunctionConfig, mockHmrcConfig } from "./mocks/mockConfig";
import { mockLogger } from "../../common/tests/logger";

import { handler } from "../src/handler";
import { NinoCheckFunctionConfig } from "../src/helpers/function-config";
import { getHmrcConfig, handleResponseAndSaveAttempt, saveTxn } from "../src/helpers/nino";
import { callPdvMatchingApi } from "../src/hmrc-apis/pdv";
import { writeCompletedCheck } from "../src/helpers/write-completed-check";
import { getTokenFromOtg } from "../src/hmrc-apis/otg";
import { buildPdvInput } from "../src/helpers/build-pdv-input";
import { captureMetric } from "../../common/src/util/metrics";
import { CriError } from "../../common/src/errors/cri-error";
import { getAttempts as attempts } from "../../common/src/database/get-attempts";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { sendRequestSentEvent, sendResponseReceivedEvent } from "../src/helpers/audit";

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

(NinoCheckFunctionConfig as unknown as jest.Mock).mockReturnValue(mockFunctionConfig);
(getSessionBySessionId as unknown as jest.Mock).mockResolvedValue(mockSession);
(getHmrcConfig as unknown as jest.Mock).mockResolvedValue(mockHmrcConfig);
(attempts as unknown as jest.Mock).mockResolvedValue({ count: 0, items: [] });
(getRecordBySessionId as unknown as jest.Mock).mockResolvedValue(mockPersonIdentity);
(getTokenFromOtg as unknown as jest.Mock).mockResolvedValue(mockOtgToken);
(callPdvMatchingApi as unknown as jest.Mock).mockResolvedValue(mockPdvRes);
(handleResponseAndSaveAttempt as unknown as jest.Mock).mockResolvedValue(true);

describe("nino-check handler", () => {
  beforeEach(() => jest.clearAllMocks());

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
    expect(sendRequestSentEvent).toHaveBeenCalledWith(
      mockFunctionConfig.audit,
      mockSession,
      mockPersonIdentity,
      mockNino,
      mockDeviceInformationHeader
    );
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
    expect(sendResponseReceivedEvent).toHaveBeenCalledWith(
      mockFunctionConfig.audit,
      mockSession,
      mockPdvRes.txn,
      mockDeviceInformationHeader
    );
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
    (getSessionBySessionId as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error("nooooooo!!!");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(NinoCheckFunctionConfig).toHaveBeenCalled();
    expect(getSessionBySessionId).toHaveBeenCalledWith(mockFunctionConfig.tableNames.sessionTable, mockSessionId, true);
    expect(getHmrcConfig).not.toHaveBeenCalled();
  });

  it("handles a too-many-attempts scenario correctly", async () => {
    (attempts as unknown as jest.Mock).mockResolvedValueOnce({ count: 2, items: [{}, {}] });

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
    (callPdvMatchingApi as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error("broken!");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(captureMetric).toHaveBeenCalledWith("MatchingLambdaErrorMetric");
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Error"));
    expect(saveTxn).not.toHaveBeenCalled();
  });

  it("behaves correctly if ninoMatch is false", async () => {
    (handleResponseAndSaveAttempt as unknown as jest.Mock).mockReturnValueOnce(false);

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: true }),
    });

    expect(writeCompletedCheck).not.toHaveBeenCalled();
    expect(captureMetric).toHaveBeenCalledWith("RetryAttemptsSentMetric");
  });

  it("should return 200 if nino match is false but it's the final attempt", async () => {
    (attempts as unknown as jest.Mock).mockResolvedValueOnce({ count: 1, items: [{}] });
    (handleResponseAndSaveAttempt as unknown as jest.Mock).mockReturnValueOnce(false);

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });
  });

  it("should return 500 if unexpected Error recieved from PDV request", async () => {
    (handleResponseAndSaveAttempt as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new CriError(500, "Error");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(writeCompletedCheck).not.toHaveBeenCalled();
  });
});
