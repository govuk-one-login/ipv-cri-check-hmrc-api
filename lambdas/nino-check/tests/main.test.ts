import { mockNino, mockPersonIdentity, mockPutObjectRes, mockSession } from "./steps/mockRecords";
import { APIGatewayProxyEvent } from "aws-lambda";
import { main } from "../src/main";
import { mockDeviceInformationHeader, mockFunctionConfig, mockHelpers, mockTableNames } from "./steps/mockConfig";
import * as getConfigModule from "../src/steps/0-get-config";
import * as getSessionInfoModule from "../src/steps/1-get-session-info";
import * as validateNinoModule from "../src/steps/2-validate-nino";
import * as issueAuthorizationCodeModule from "../src/steps/3-issue-authorization-code";
import * as updateModule from "../../common/src/database/update-record-by-session-id";
import * as insertModule from "../../common/src/database/insert-record";
import { RecordExpiredError, RecordNotFoundError } from "../../common/src/database/exceptions/errors";
import { TooManyAttemptsError } from "../src/exceptions/errors";
import { FailedAuthError, FailedMatchError, PdvApiError, PersonDeceasedError } from "../src/hmrc-apis/exceptions/pdv";
import { CriError } from "../../common/src/errors/cri-error";

const getTableNames = jest.spyOn(getConfigModule, "getConfig");
const getSessionInfo = jest.spyOn(getSessionInfoModule, "getSessionInfo");
const validateNino = jest.spyOn(validateNinoModule, "validateNino");
const issueAuthorizationCode = jest.spyOn(issueAuthorizationCodeModule, "issueAuthorizationCode");
const updateRecordBySessionId = jest.spyOn(updateModule, "updateRecordBySessionId");
const insertRecord = jest.spyOn(insertModule, "insertRecord");

const handlerInput: Parameters<typeof main> = [
  {
    headers: {
      "session-id": mockSession.sessionId,
      "txma-audit-encoded": mockDeviceInformationHeader,
    },
    body: JSON.stringify({
      nino: mockNino,
    }),
  } as unknown as APIGatewayProxyEvent,
  mockHelpers,
];

describe("nino-check handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    getTableNames.mockReturnValue(mockFunctionConfig);
    getSessionInfo.mockResolvedValue({
      session: mockSession,
      personIdentity: mockPersonIdentity,
      isFinalAttempt: false,
    });
    validateNino.mockResolvedValue({ ninoMatch: true });
    updateRecordBySessionId.mockResolvedValue(mockPutObjectRes);
    insertRecord.mockResolvedValue(mockPutObjectRes);
  });

  it("executes successfully with a valid input", async () => {
    const response = await main(...handlerInput);

    expect(getTableNames).toHaveBeenCalled();
    expect(getSessionInfo).toHaveBeenCalledWith(mockTableNames, mockHelpers, mockSession.sessionId);
    expect(validateNino).toHaveBeenCalledWith(
      mockSession.clientId,
      mockFunctionConfig,
      mockHelpers,
      mockPersonIdentity,
      mockSession,
      mockNino
    );
    expect(issueAuthorizationCode).toHaveBeenCalledWith(mockTableNames, mockHelpers, mockSession.sessionId, mockNino);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });
  });

  it("throws if sessionId or nino are missing", async () => {
    await expect(() =>
      main(
        {
          body: `{"nino":"blahblah"}`,
          headers: { "txma-audit-encoded": mockDeviceInformationHeader },
        } as unknown as APIGatewayProxyEvent,
        mockHelpers
      )
    ).rejects.toThrow(CriError);

    await expect(() =>
      main(
        {
          body: `{}`,
          headers: {
            "session-id": mockSession.sessionId,
            "txma-audit-encoded": mockDeviceInformationHeader,
          },
        } as unknown as APIGatewayProxyEvent,
        mockHelpers
      )
    ).rejects.toThrow(CriError);

    await expect(() =>
      main(
        {
          headers: {
            "session-id": mockSession.sessionId,
            "txma-audit-encoded": mockDeviceInformationHeader,
          },
        } as unknown as APIGatewayProxyEvent,
        mockHelpers
      )
    ).rejects.toThrow(CriError);
  });

  it("fails if getConfig() throws an error", async () => {
    const error = new Error(`Missing required environment variable at init: "COOL_ENV_VAR"`);
    getTableNames.mockImplementation(() => {
      throw error;
    });

    await expect(async () => main(...handlerInput)).rejects.toThrow(error);
    expect(getSessionInfo).not.toHaveBeenCalled();
  });

  describe("Error handling: getSessionInfo()", () => {
    it("handles RecordExpiredError correctly", async () => {
      // record expired
      getSessionInfo.mockImplementation(() => {
        throw new RecordExpiredError(mockTableNames.sessionTable, mockSession.sessionId, [17]);
      });

      await expect(async () => main(...handlerInput)).rejects.toThrow(CriError);

      expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(`InvalidSessionErrorMetric`);
      expect(validateNino).not.toHaveBeenCalled();
    });

    it("handles RecordNotFoundError correctly", async () => {
      getSessionInfo.mockImplementation(() => {
        throw new RecordNotFoundError(mockTableNames.personIdentityTable, mockSession.sessionId);
      });

      await expect(async () => main(...handlerInput)).rejects.toThrow(CriError);

      expect(validateNino).not.toHaveBeenCalled();
    });

    it("handles TooManyAttemptsError correctly", async () => {
      getSessionInfo.mockImplementation(() => {
        throw new TooManyAttemptsError(mockSession.sessionId, 5, 2);
      });

      const tooManyAttemptsResult = await main(...handlerInput);

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

      await expect(async () => main(...handlerInput)).rejects.toThrow(CriError);
      expect(validateNino).not.toHaveBeenCalled();
    });
  });

  describe("Error handling: validateNino", () => {
    it("handles PdvApiError correctly", async () => {
      validateNino.mockImplementation(() => {
        throw new PdvApiError(999);
      });

      await expect(async () => main(...handlerInput)).rejects.toThrow(CriError);

      expect(issueAuthorizationCode).not.toHaveBeenCalled();
    });

    it("handles FailedAuthError correctly", async () => {
      const error = new FailedAuthError();

      validateNino.mockImplementation(() => {
        throw error;
      });

      await expect(async () => main(...handlerInput)).rejects.toThrow(CriError);
      expect(issueAuthorizationCode).not.toHaveBeenCalled();
    });

    it("handles a FailedMatchError correctly", async () => {
      validateNino.mockImplementation(() => {
        throw new FailedMatchError(mockSession.sessionId);
      });

      const failedResult = await main(...handlerInput);

      expect(issueAuthorizationCode).not.toHaveBeenCalled();
      expect(failedResult).toStrictEqual({
        statusCode: 200,
        body: JSON.stringify({ requestRetry: true }),
      });
    });

    it("handles a PersonDeceasedError correctly", async () => {
      validateNino.mockImplementation(() => {
        throw new PersonDeceasedError();
      });

      const deceasedResult = await main(...handlerInput);

      expect(issueAuthorizationCode).not.toHaveBeenCalled();
      expect(deceasedResult).toStrictEqual({
        statusCode: 200,
        body: JSON.stringify({ requestRetry: true }),
      });
    });

    it("throws InternalServerError for any other error it gets", async () => {
      const error = new Error("Yikes");

      validateNino.mockImplementation(() => {
        throw error;
      });

      await expect(async () => main(...handlerInput)).rejects.toThrow(CriError);

      expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(`MatchingLambdaErrorMetric`);
      expect(issueAuthorizationCode).not.toHaveBeenCalled();
    });
  });

  it("issues an auth code and does not request a retry if the check fails but isFinalAttempt=true", async () => {
    getSessionInfo.mockResolvedValue({
      session: mockSession,
      personIdentity: mockPersonIdentity,
      isFinalAttempt: true,
    });

    validateNino.mockImplementation(() => {
      throw new FailedMatchError(mockSession.sessionId);
    });

    const result = await main(...handlerInput);

    expect(issueAuthorizationCode).toHaveBeenCalled();
    expect(result).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });
  });

  it("throws if issueAuthorizationCode() fails", async () => {
    issueAuthorizationCode.mockImplementation(() => {
      throw new Error("illegal");
    });

    await expect(async () => main(...handlerInput)).rejects.toThrow(CriError);
  });
});
