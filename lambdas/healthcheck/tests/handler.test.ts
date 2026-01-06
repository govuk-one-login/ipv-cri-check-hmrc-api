import { mockLogger } from "../../common/tests/logger";

jest.mock("../../common/src/util/logger", () => ({
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

const otgUrl = "https://otg.hmrc.com";
const pdvUrl = "https://pdv.hmrc.com";
const mockPdvResponse: ParsedPdvMatchResponse = { httpStatus: 401, errorBody: "could not find that guy", txn: "txn" };
const mockPdvErrorResponse: ParsedPdvMatchResponse = { httpStatus: 500, errorBody: "unhappy :(", txn: "badTxn" };
const mockPdvHappyResponse: ParsedPdvMatchResponse = { httpStatus: 200, errorBody: "", txn: "happyTxn" };
const mockOtgToken = "otg-token";
const mockFetchMessage = "no service here";
const mockFetchRes = { status: 404, text: jest.fn().mockResolvedValue(mockFetchMessage) } as unknown as Response;
const apiGatewayPath = "/get/healthcheck/thirdparty";
const hmrcHost = "https://api.service.hmrc.gov.uk/";
const testUser = {
  firstName: expect.any(String),
  lastName: expect.any(String),
  dateOfBirth: expect.stringMatching(/\d\d\d\d-\d\d-\d\d/),
  nino: "AA000000A",
};

const getHmrcConfigMock = jest.spyOn(getHmrcConfigFile, "getHmrcConfig").mockResolvedValue({
  pdv: { apiUrl: pdvUrl },
  otg: { apiUrl: otgUrl },
});
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
    expect(fetchMock).toHaveBeenCalledWith(hmrcHost);
    expect(getTokenFromOtgMock).toHaveBeenCalledWith({ apiUrl: otgUrl });
    expect(callPdvMatchingApiMock).toHaveBeenCalledWith(
      { apiUrl: pdvUrl },
      mockOtgToken,
      expect.objectContaining(testUser)
    );

    expect(res.statusCode).toEqual(200);
    expect(JSON.parse(res.body)).toStrictEqual({ message: "success" });
  });

  it(`returns a report under expected conditions`, async () => {
    const res = await handler(...reportHandlerInput);

    expect(res.statusCode).toEqual(200);
    expect(JSON.parse(res.body)).toStrictEqual({
      hmrcHost: {
        url: hmrcHost,
        status: mockFetchRes.status,
        body: mockFetchMessage,
      },
      otg: {
        url: otgUrl,
        tokenLength: mockOtgToken.length,
      },
      pdv: {
        url: pdvUrl,
        testUser,
        response: mockPdvResponse,
      },
    });
  });

  describe(`healthcheck fails if something is wrong`, () => {
    it(`fails and logs execution errors`, async () => {
      fetchMock.mockImplementationOnce(() => {
        throw new Error(`broken!`);
      });

      const res = await handler(...healthcheckHandlerInput);

      expect(res.statusCode).toEqual(500);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Error: broken!`));
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
    it(`returns a report correctly if HMRC host and/or OTG are broken`, async () => {
      fetchMock.mockResolvedValueOnce({ ...mockFetchRes, status: 500 });
      getTokenFromOtgMock.mockImplementationOnce(() => {
        throw new Error(`otg bad times!`);
      });

      const res = await handler(...reportHandlerInput);

      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.body)).toStrictEqual({
        hmrcHost: {
          url: hmrcHost,
          status: 500,
          body: expect.any(String),
        },
        otg: {
          url: otgUrl,
          tokenLength: "N/A",
          error: expect.stringContaining("Error: otg bad times!"),
        },
        pdv: {
          url: pdvUrl,
          testUser,
          response: "N/A",
        },
      });
    });

    it(`returns a report if PDV is broken`, async () => {
      callPdvMatchingApiMock.mockImplementationOnce(() => {
        throw new Error(`pdv bad times!`);
      });

      const res = await handler(...reportHandlerInput);

      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.body)).toStrictEqual({
        hmrcHost: {
          url: hmrcHost,
          status: mockFetchRes.status,
          body: mockFetchMessage,
        },
        otg: {
          url: otgUrl,
          tokenLength: mockOtgToken.length,
        },
        pdv: {
          url: pdvUrl,
          testUser,
          response: "N/A",
          error: expect.stringContaining("Error: pdv bad times!"),
        },
      });
    });
  });

  describe(`fails if misconfigured`, () => {
    beforeEach(() => {
      process.env.CLIENT_ID = "mr-client";
      process.env.LOG_FULL_ERRORS = "true";
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

    it(`fails if passed an unexpected path`, async () => {
      const res = await handler({ ...healthcheckHandlerInput[0], path: "mr blobby" }, healthcheckHandlerInput[1]);

      expect(res.statusCode).toEqual(400);
    });
  });
});
