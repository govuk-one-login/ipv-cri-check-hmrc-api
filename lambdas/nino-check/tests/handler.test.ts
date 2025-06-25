import { mockNino, mockPersonIdentity, mockSession } from "./mocks/mockRecords";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import {
  mockDeviceInformationHeader,
  mockDynamoClient,
  mockEventBridgeClient,
  mockFunctionConfig,
  mockHelpers as importedHelpers,
  mockTableNames,
} from "./mocks/mockConfig";
import * as functionConfigModule from "../src/helpers/function-config";
import * as getSessionInfoModule from "../src/helpers/get-session-info";
import * as validateNinoModule from "../src/helpers/validate-nino";
import * as addAuthCodeToSessionModule from "../src/helpers/add-auth-code-to-session";
import { RecordExpiredError, RecordNotFoundError } from "../../common/src/database/exceptions/errors";
import { TooManyAttemptsError } from "../src/exceptions/errors";
import { MetricsHelper } from "../../logging/metrics-helper";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockLogger } from "../../common/tests/logger";
import { mockMetricsHelper } from "../../common/tests/metrics-helper";
import { Logger } from "@aws-lambda-powertools/logger";
import { Helpers } from "../src/types/input";
jest.mock("@aws-lambda-powertools/logger");
(Logger as unknown as jest.Mock).mockReturnValue(mockLogger);
import { handler } from "../src/handler";

const NinoCheckFunctionConfig = jest.spyOn(functionConfigModule, "NinoCheckFunctionConfig");
const getSessionInfo = jest.spyOn(getSessionInfoModule, "getSessionInfo");
const validateNino = jest.spyOn(validateNinoModule, "validateNino");
const addAuthCodeToSession = jest.spyOn(addAuthCodeToSessionModule, "addAuthCodeToSession");

const mockHelpers: Helpers = {
  ...importedHelpers,
  functionStartTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
};

jest.mock("../../logging/metrics-helper");
jest.mock("@aws-sdk/client-eventbridge");
jest.mock("@aws-sdk/client-dynamodb");

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

const badRequest = {
  statusCode: 400,
  body: expect.stringContaining('"message":'),
};

const handlerInput: Parameters<typeof handler> = [
  {
    headers: {
      "session-id": mockSession.sessionId,
      "txma-audit-encoded": mockDeviceInformationHeader,
    },
    body: JSON.stringify({
      nino: mockNino,
    }),
  } as unknown as APIGatewayProxyEvent,
  mockContext,
];

describe("nino-check handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    NinoCheckFunctionConfig.mockReturnValue(mockFunctionConfig);
    getSessionInfo.mockResolvedValue({
      session: mockSession,
      personIdentity: mockPersonIdentity,
      isFinalAttempt: false,
    });
    validateNino.mockResolvedValue({ ninoMatch: true });

    (MetricsHelper as unknown as jest.Mock).mockReturnValue(mockMetricsHelper);
    (EventBridgeClient as unknown as jest.Mock).mockReturnValue(mockEventBridgeClient);
    (DynamoDBClient as unknown as jest.Mock).mockReturnValue(mockDynamoClient);
  });

  it("executes successfully with a valid input", async () => {
    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });

    expect(NinoCheckFunctionConfig).toHaveBeenCalled();
    expect(getSessionInfo).toHaveBeenCalledWith(mockTableNames, mockHelpers, mockSession.sessionId);
    expect(validateNino).toHaveBeenCalledWith(
      mockSession.clientId,
      mockFunctionConfig,
      mockHelpers,
      mockPersonIdentity,
      mockSession,
      mockNino
    );
    expect(addAuthCodeToSession).toHaveBeenCalledWith(mockTableNames, mockHelpers, mockSession.sessionId, mockNino);
  });

  it("fails if getConfig() throws an error", async () => {
    const error = new Error(`Missing required environment variable at init: "COOL_ENV_VAR"`);
    NinoCheckFunctionConfig.mockImplementation(() => {
      throw error;
    });

    const res = await handler(...handlerInput);
    expect(res).toEqual(internalServerError);
    expect(getSessionInfo).not.toHaveBeenCalled();
  });

  describe("Error handling: getSessionInfo()", () => {
    it("handles RecordExpiredError correctly", async () => {
      // record expired
      getSessionInfo.mockImplementation(() => {
        throw new RecordExpiredError(mockTableNames.sessionTable, mockSession.sessionId, [17]);
      });

      const res = await handler(...handlerInput);
      expect(res).toEqual(badRequest);

      expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(`InvalidSessionErrorMetric`);
      expect(validateNino).not.toHaveBeenCalled();
    });

    it("handles RecordNotFoundError correctly", async () => {
      getSessionInfo.mockImplementation(() => {
        throw new RecordNotFoundError(mockTableNames.sessionTable, mockSession.sessionId);
      });

      const sessionRes = await handler(...handlerInput);

      expect(sessionRes).toEqual(badRequest);

      getSessionInfo.mockImplementation(() => {
        throw new RecordNotFoundError(mockTableNames.personIdentityTable, mockSession.sessionId);
      });

      const personIdentityRes = await handler(...handlerInput);

      expect(personIdentityRes).toEqual(internalServerError);

      expect(validateNino).not.toHaveBeenCalled();
    });

    it("handles TooManyAttemptsError correctly", async () => {
      getSessionInfo.mockImplementation(() => {
        throw new TooManyAttemptsError(mockSession.sessionId, 5, 2);
      });

      const tooManyAttemptsResult = await handler(...handlerInput);

      expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(`AttemptsExceededMetric`);
      expect(tooManyAttemptsResult).toStrictEqual({
        statusCode: 200,
        body: JSON.stringify({ requestRetry: false }),
      });
      expect(validateNino).not.toHaveBeenCalled();
    });

    it("throws InternalServerError for any other error it gets", async () => {
      const error = new Error("oh no!!!");

      getSessionInfo.mockImplementation(() => {
        throw error;
      });

      const res = await handler(...handlerInput);
      expect(res).toEqual(internalServerError);
      expect(validateNino).not.toHaveBeenCalled();
    });
  });

  describe("Error handling: validateNino", () => {
    it("handles PdvApiError correctly", async () => {
      validateNino.mockImplementation(() => {
        throw new Error("999");
      });

      const res = await handler(...handlerInput);
      expect(res).toEqual(internalServerError);
      expect(addAuthCodeToSession).not.toHaveBeenCalled();
    });

    it("handles FailedAuthError correctly", async () => {
      const error = new Error();

      validateNino.mockImplementation(() => {
        throw error;
      });

      const res = await handler(...handlerInput);

      expect(res).toEqual(internalServerError);
      expect(addAuthCodeToSession).not.toHaveBeenCalled();
    });

    it("throws InternalServerError for any other error it gets", async () => {
      const error = new Error("Yikes");

      validateNino.mockImplementation(() => {
        throw error;
      });

      const res = await handler(...handlerInput);

      expect(res).toEqual(internalServerError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining(String(error)) })
      );
      expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(`MatchingLambdaErrorMetric`);
      expect(addAuthCodeToSession).not.toHaveBeenCalled();
    });
  });

  it("issues an auth code and does not request a retry if the check fails but isFinalAttempt=true", async () => {
    getSessionInfo.mockResolvedValue({
      session: mockSession,
      personIdentity: mockPersonIdentity,
      isFinalAttempt: true,
    });

    validateNino.mockResolvedValue({ ninoMatch: false });

    const result = await handler(...handlerInput);

    expect(addAuthCodeToSession).toHaveBeenCalled();
    expect(result).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });
  });

  it("throws if issueAuthorizationCode() fails", async () => {
    addAuthCodeToSession.mockImplementation(() => {
      throw new Error("illegal");
    });

    const res = await handler(...handlerInput);
    expect(res).toEqual(internalServerError);
  });
});
