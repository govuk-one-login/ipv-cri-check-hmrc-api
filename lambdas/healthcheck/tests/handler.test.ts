import { mockLogger } from "../../common/tests/logger";

jest.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
jest.mock("../../common/src/util/metrics");

import * as getHmrcConfigFile from "../../common/src/config/get-hmrc-config";
import * as otgFile from "../../common/src/hmrc-apis/otg";
import * as pdvFile from "../../common/src/hmrc-apis/pdv";
import { handler } from "../src/handler";
import { ParsedPdvMatchResponse } from "../../common/src/hmrc-apis/types/pdv";

process.env.CLIENT_ID = "mr-client";
process.env.LOG_FULL_ERRORS = "true";
process.env.TIMEOUT_TIME_SECONDS = "0.5";

const pdvHost = "https://pdv.hmrc.com";
const otgUrl = "https://otg.hmrc.com";
const pdvUrl = `${pdvHost}/gimme-pdv`;
const mockPdvResponse: ParsedPdvMatchResponse = { httpStatus: 401, errorBody: "could not find that guy", txn: "txn" };
const mockPdvErrorResponse: ParsedPdvMatchResponse = { httpStatus: 500, errorBody: "unhappy :(", txn: "badTxn" };
const mockPdvHappyResponse: ParsedPdvMatchResponse = { httpStatus: 200, errorBody: "", txn: "happyTxn" };
const mockOtgToken = "otg-token";
const mockFetchMessage = "no service here";
const mockFetchRes = { status: 404, text: jest.fn().mockResolvedValue(mockFetchMessage) } as unknown as Response;
const apiGatewayPath = "/healthcheck/thirdparty";
const testUser = {
  firstName: expect.any(String),
  lastName: expect.any(String),
  dateOfBirth: expect.stringMatching(/\d\d\d\d-\d\d-\d\d/),
  nino: "AA000000A",
};

const mockHmrcConfig = {
  pdv: { apiUrl: pdvUrl },
  otg: { apiUrl: otgUrl },
};

const getHmrcConfigMock = jest.spyOn(getHmrcConfigFile, "getHmrcConfig").mockResolvedValue(mockHmrcConfig);
const callPdvMatchingApiMock = jest.spyOn(pdvFile, "callPdvMatchingApi").mockResolvedValue(mockPdvResponse);
const getTokenFromOtgMock = jest.spyOn(otgFile, "getTokenFromOtg").mockResolvedValue(mockOtgToken);
const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(mockFetchRes);

const healthcheckHandlerInput = [{ path: apiGatewayPath }, {}] as unknown as Parameters<typeof handler>;
const reportHandlerInput: Parameters<typeof handler> = [
  { ...healthcheckHandlerInput[0], path: `${apiGatewayPath}/info` },
  healthcheckHandlerInput[1],
];

describe(`handler`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`passes under expected conditions`, async () => {
    const res = await handler(...healthcheckHandlerInput);

    expect(getHmrcConfigMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(pdvHost, { method: "HEAD", signal: expect.any(Object) });
    expect(getTokenFromOtgMock).toHaveBeenCalledWith({ apiUrl: otgUrl }, expect.any(Object));
    expect(callPdvMatchingApiMock).toHaveBeenCalledWith(
      { apiUrl: pdvUrl },
      mockOtgToken,
      expect.objectContaining(testUser),
      expect.any(Object)
    );

    expect(res.statusCode).toEqual(200);
    expect(JSON.parse(res.body)).toStrictEqual({ message: "success" });
  });

  it(`returns a report under expected conditions`, async () => {
    const res = await handler(...reportHandlerInput);

    expect(res.statusCode).toEqual(200);
    expect(JSON.parse(res.body)).toStrictEqual({
      healthcheckPassed: true,
      hmrcConfig: {
        passed: true,
        latency: expect.any(Number),
        result: mockHmrcConfig,
      },
      hmrcHost: {
        passed: true,
        latency: expect.any(Number),
        result: { status: mockFetchRes.status },
      },
      otg: {
        passed: true,
        latency: expect.any(Number),
        result: { tokenLength: mockOtgToken.length },
      },
      pdv: {
        passed: true,
        latency: expect.any(Number),
        result: { status: mockPdvResponse.httpStatus },
      },
    });
  });

  describe(`healthcheck fails if something is wrong`, () => {
    it(`fails if it can't get HMRC config`, async () => {
      getHmrcConfigMock.mockImplementationOnce(() => {
        throw new Error(`broken!`);
      });

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });

    it(`fails if the HMRC host returns a 5xx`, async () => {
      fetchMock.mockResolvedValueOnce({ ...mockFetchRes, status: 500 });

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });

    it(`fails if no token is retrieved`, async () => {
      getTokenFromOtgMock.mockResolvedValueOnce("");

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });

    it(`fails if PDV returns a 5xx error`, async () => {
      callPdvMatchingApiMock.mockResolvedValueOnce(mockPdvErrorResponse);

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });

    it(`fails if PDV returns a 2xx response for the fake user`, async () => {
      callPdvMatchingApiMock.mockResolvedValueOnce(mockPdvHappyResponse);

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });
  });

  describe(`report is returned if something breaks`, () => {
    it(`returns a report correctly if HMRC config fetch is broken`, async () => {
      getHmrcConfigMock.mockImplementationOnce(() => {
        throw new Error(`broken!`);
      });

      const res = await handler(...reportHandlerInput);

      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.body)).toStrictEqual({
        healthcheckPassed: false,
        hmrcConfig: {
          passed: false,
          latency: expect.any(Number),
          error: expect.stringContaining("Error: broken!"),
        },
        hmrcHost: expect.stringContaining("N/A"),
        otg: expect.stringContaining("N/A"),
        pdv: expect.stringContaining("N/A"),
      });
    });

    it(`returns a report correctly if HMRC host and/or OTG are broken`, async () => {
      fetchMock.mockResolvedValueOnce({
        ...mockFetchRes,
        status: 500,
        text: jest.fn().mockResolvedValue("hmrc down!"),
      });
      getTokenFromOtgMock.mockImplementationOnce(() => {
        throw new Error(`otg bad times!`);
      });

      const res = await handler(...reportHandlerInput);

      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.body)).toStrictEqual({
        healthcheckPassed: false,
        hmrcConfig: {
          passed: true,
          latency: expect.any(Number),
          result: mockHmrcConfig,
        },
        hmrcHost: {
          passed: false,
          latency: expect.any(Number),
          result: {
            status: 500,
          },
          error: expect.stringContaining("500"),
        },
        otg: {
          passed: false,
          latency: expect.any(Number),
          error: expect.stringContaining("Error: otg bad times!"),
        },
        pdv: expect.stringContaining("N/A"),
      });
    });

    it(`returns a report if PDV is broken`, async () => {
      callPdvMatchingApiMock.mockImplementationOnce(() => {
        throw new Error(`pdv bad times!`);
      });

      const res = await handler(...reportHandlerInput);

      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.body)).toStrictEqual({
        healthcheckPassed: false,
        hmrcConfig: {
          passed: true,
          latency: expect.any(Number),
          result: mockHmrcConfig,
        },
        hmrcHost: {
          passed: true,
          latency: expect.any(Number),
          result: { status: mockFetchRes.status },
        },
        otg: {
          passed: true,
          latency: expect.any(Number),
          result: {
            tokenLength: mockOtgToken.length,
          },
        },
        pdv: {
          passed: false,
          latency: expect.any(Number),
          error: expect.stringContaining("Error: pdv bad times!"),
        },
      });
    });

    it(`reports correctly if something times out`, async () => {
      getTokenFromOtgMock.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      const res = await handler(...reportHandlerInput);

      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.body)).toStrictEqual({
        healthcheckPassed: false,
        hmrcConfig: {
          passed: true,
          latency: expect.any(Number),
          result: mockHmrcConfig,
        },
        hmrcHost: {
          passed: true,
          latency: expect.any(Number),
          result: { status: mockFetchRes.status },
        },
        otg: {
          passed: false,
          latency: expect.any(Number),
          error: expect.stringContaining("Timed out"),
        },
        pdv: expect.stringContaining("N/A"),
      });
    });
  });

  describe(`fails if misconfigured`, () => {
    beforeEach(() => {
      process.env.CLIENT_ID = "mr-client";
      process.env.LOG_FULL_ERRORS = "true";
      process.env.TIMEOUT_TIME_SECONDS = "0.5";
    });

    it(`fails if no client ID is given`, async () => {
      delete process.env.CLIENT_ID;

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });

    it(`fails if LOG_FULL_ERRORS isn't true`, async () => {
      process.env.LOG_FULL_ERRORS = "thrue";

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });

    it(`fails if TIMEOUT_TIME_SECONDS is unset`, async () => {
      process.env.TIMEOUT_TIME_SECONDS = undefined;

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
    });

    it(`fails if passed an unexpected path`, async () => {
      const res = await handler({ ...healthcheckHandlerInput[0], path: "mr blobby" }, healthcheckHandlerInput[1]);

      expect(res.statusCode).toEqual(400);
    });
  });
});
