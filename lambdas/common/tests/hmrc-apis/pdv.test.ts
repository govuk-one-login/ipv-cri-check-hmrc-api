import { mockLogger } from "../../../common/tests/logger";
vi.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
vi.mock("@govuk-one-login/cri-metrics");
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

vi.mocked(captureLatency).mockImplementation(async (_, callback) => {
    const result = await callback();
    return { result, latencyInMs };
  });

global.fetch = vi.fn();

describe("matchUserDetailsWithPdv", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return a matching response for a given nino and user", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: vi.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dateOfBirth: "1948-04-23",
        nino: "AA000003D",
      }),
      status: 200,
    } as unknown as Response);

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
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce(undefined).mockReturnValueOnce("application/json"),
      },
      text: vi.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dateOfBirth: "1948-04-23",
        nino: "AA000003D",
      }),
      status: 200,
    } as unknown as Response);

    const result2 = await callPdvMatchingApi(...mockInput);

    expect(result2.httpStatus).toBe(200);
    expect(result2.txn).toStrictEqual("");
  });

  it("should return 500 with internal server error", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: vi.fn().mockResolvedValueOnce("dummy-error-message-containing-pii"),
      status: 500,
    } as unknown as Response);

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(500);
    expect(result.errorBody).toStrictEqual("Internal server error");
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should return a valid response when the content-type is application/json and the body is not valid JSON", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("content-type").mockReturnValueOnce("application/json"),
      },
      text: vi.fn().mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 422,
    } as unknown as Response);

    const result = await callPdvMatchingApi(...mockInput);

    expect(logger.error).toHaveBeenCalled();

    expect(result.httpStatus).toBe(422);
    expect(result.errorBody).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return text when content type is not json", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: vi.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    } as unknown as Response);

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(200);
    expect(result.errorBody).toStrictEqual("");
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should log API latency, and push a metric", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: vi.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    } as unknown as Response);

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
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn"),
      },
      text: vi.fn().mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 424,
    } as unknown as Response);

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(424);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return parsed deceased response even with JSON contentt-type header", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: vi.fn().mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 424,
    } as unknown as Response);

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(424);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return parsed matching error response", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: vi.fn().mockResolvedValueOnce(JSON.stringify({ errors: "CID returned no record" })),
      status: 401,
    } as unknown as Response);

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(401);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual({
      type: "matching_error",
      errorMessage: "CID returned no record",
    });
  });

  it("should return parsed invalid creds error response", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      headers: {
        get: vi.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: vi.fn().mockResolvedValueOnce(JSON.stringify({ code: "INVALID_CREDENTIALS" })),
      status: 401,
    } as unknown as Response);

    const result = await callPdvMatchingApi(...mockInput);

    expect(result.httpStatus).toBe(401);
    expect(result.txn).toStrictEqual("mock-txn");
    expect(result.errorBody).toStrictEqual({
      type: "invalid_creds",
      errorMessage: "INVALID_CREDENTIALS",
    });
  });
});
