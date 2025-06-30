jest.mock("../../../common/src/util/metrics");
jest.mock("../../../common/src/util/logger");
import { PdvApiInput } from "../../src/hmrc-apis/types/pdv";
import { logger } from "../../../common/src/util/logger";
import { captureLatency } from "../../../common/src/util/metrics";
import { matchUserDetailsWithPdv } from "../../src/hmrc-apis/pdv";

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

const latency = 1001;

(captureLatency as unknown as jest.Mock).mockImplementation(async (_, callback) => [await callback(), latency]);

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

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(result.httpStatus).toBe(200);
    expect(result.body).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dateOfBirth: "1948-04-23",
      nino: "AA000003D",
    });
    expect(result.txn).toStrictEqual("mock-txn");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PDV API response received",
        url: apiUrl,
        status: 200,
        latencyInMs: latency,
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

    const result2 = await matchUserDetailsWithPdv(...mockInput);

    expect(result2.httpStatus).toBe(200);
    expect(result2.body).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dateOfBirth: "1948-04-23",
      nino: "AA000003D",
    });
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

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(result.httpStatus).toBe(500);
    expect(result.body).toStrictEqual("Internal server error");
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

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(logger.error).toHaveBeenCalled();

    expect(result.httpStatus).toBe(422);
    expect(result.body).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return text when content type is not json", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(result.httpStatus).toBe(200);
    expect(result.body).toStrictEqual("Test Text");
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should return an error message when response has no content-type and has no body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      status: 200,
    });
    await expect(matchUserDetailsWithPdv(...mockInput)).rejects.toThrow();
  });

  it("should log API latency, and push a metric", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    await matchUserDetailsWithPdv(...mockInput);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PDV API response received",
        url: apiUrl,
        status: 200,
        latencyInMs: expect.anything(),
      })
    );
  });
});
