import { mockLogger } from "../../../common/tests/logger";
jest.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
jest.mock("@govuk-one-login/cri-metrics");
import { logger } from "@govuk-one-login/cri-logger";
import { captureLatency } from "@govuk-one-login/cri-metrics";
import { getTokenFromOtg } from "../../src/hmrc-apis/otg";

const apiUrl = "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub";

const mockParams = [{ apiUrl }] as const;

const latencyInMs = 1001;

(captureLatency as unknown as jest.Mock).mockImplementation(async (_, callback) => {
    const result = await callback();
    return { result, latencyInMs };
  });

const mockToken = "goodToken";
const mockExpiry = Date.now() + 600000;

global.fetch = jest.fn();
(global.fetch as jest.Mock).mockResolvedValueOnce({
  json: jest.fn().mockResolvedValueOnce({
    token: mockToken,
    expiry: mockExpiry,
  }),
  status: 200,
  ok: true,
});

describe("getTokenFromOtg", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the token and log the outcome", async () => {
    const token = await getTokenFromOtg(...mockParams);
    expect(token).toBe(mockToken);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "OTG API response received",
        url: apiUrl,
        status: 200,
        latencyInMs,
      })
    );
  });

  it("should throw when an invalid response is returned from OTG", async () => {
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce({}),
      ok: false,
      status: 400,
      statusText: "Forbidden",
    });

    await expect(() => getTokenFromOtg(...mockParams)).rejects.toThrow(
      new Error("Error response received from OTG 400 Forbidden")
    );
  });

  it("should throw when the bearer token has expired", async () => {
    const mockToken = "goodToken";
    const mockExpiry = Date.now() - 600000;

    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce({
        token: mockToken,
        expiry: mockExpiry,
      }),
      status: 200,
      ok: true,
    });

    await expect(() => getTokenFromOtg(...mockParams)).rejects.toThrow(
      new Error("OTG returned an expired Bearer Token")
    );
  });
});
