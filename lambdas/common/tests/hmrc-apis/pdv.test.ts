import { mockLogger } from "../../../common/tests/logger";
jest.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
jest.mock("@govuk-one-login/cri-metrics");
import { PdvApiInput } from "../../src/hmrc-apis/types/pdv";
import { logger } from "@govuk-one-login/cri-logger";
import { captureLatency } from "@govuk-one-login/cri-metrics";
import { callPdvMatchingApi } from "../../src/hmrc-apis/pdv";

const apiUrl = "https://test-api.service.hmrc.gov.uk/individuals/authentication/authenticator/match";
const userAgent = "govuk-one-login";
const oAuthToken = "123";
const dateOfBirth = "1948-04-23";
const nino = "AA000003D";
const pdvConfig = { apiUrl, userAgent };

const pdvInput: PdvApiInput = {
  firstName: "Jim",
  lastName: "Ferguson",
  dateOfBirth,
  nino,
};

const mockInput = [pdvConfig, oAuthToken, pdvInput] as const;

const latencyInMs = 1001;

(captureLatency as unknown as jest.Mock).mockImplementation(async (_, callback) => {
    const result = await callback();
    return { result, latencyInMs };
  });

global.fetch = jest.fn();

describe("matchUserDetailsWithPdv", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return a matching response for a given nino and user", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dateOfBirth: "1948-04-23",
        nino: "AA000003D",
      }),
      status: 200,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(200);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PDV API response received",
        url: apiUrl,
        status: 200,
        latencyInMs,
      })
    );
  });

  it("does not fail if x-amz-cf-id header is unset", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce(undefined).mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dateOfBirth: "1948-04-23",
        nino: "AA000003D",
      }),
      status: 200,
    });

    const result2 = await callPdvMatchingApi(...mockInput);

    expect(result2.httpStatus).toBe(200);
    expect(result2.txn).toStrictEqual("");
  });

  it("should return 500 with internal server error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce("dummy-error-message-containing-pii"),
      status: 500,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(500);
    expect(result.errorBody).toStrictEqual("Internal server error");
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should return a valid response when the content-type is application/json and the body is not valid JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("content-type").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 422,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(logger.error).toHaveBeenCalled();

    expect(result.httpStatus).toBe(422);
    expect(result.errorBody).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return text when content type is not json", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(200);
    expect(result.errorBody).toStrictEqual("");
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should log API latency, and push a metric", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    await callPdvMatchingApi(...mockInput);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PDV API response received",
        url: apiUrl,
        status: 200,
        latencyInMs: expect.anything(),
      })
    );
  });

  it("should return parsed deceased response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn"),
      },
      text: jest.fn().mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 424,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(424);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return parsed deceased response even with JSON contentt-type header", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 424,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(424);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return parsed matching error response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce(JSON.stringify({ errors: "CID returned no record" })),
      status: 401,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(401);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual({
      type: "matching_error",
      errorMessage: "CID returned no record",
    });
  });

  it("should return parsed invalid creds error response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce(JSON.stringify({ code: "INVALID_CREDENTIALS" })),
      status: 401,
    });

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(401);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual({
      type: "invalid_creds",
      errorMessage: "INVALID_CREDENTIALS",
    });
  });
});
