import { getTokenFromOtg } from "../../src/hmrc-apis/otg";
import { mockLogger } from "../../../common/tests/logger";
import { mockMetricsHelper } from "../../../common/tests/metrics-helper";

const apiUrl = "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub";

const mockParams = [{ apiUrl }, mockLogger, mockMetricsHelper] as const;

describe("getTokenFromOtg", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a token and expiry", async () => {
    const mockToken = "goodToken";
    const mockExpiry = Date.now() + 600000;

    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce({
        token: mockToken,
        expiry: mockExpiry,
      }),
      ok: true,
    });

    const result = await getTokenFromOtg(...mockParams);
    expect(result.token).toBe(mockToken);
    expect(result.expiry).toBe(mockExpiry);

    expect(mockMetricsHelper.captureResponseLatency).toHaveBeenCalledWith(expect.any(Number), "OTGHandler");
  });

  it("should log API latency and push the metric", async () => {
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

    await getTokenFromOtg(...mockParams);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "OTG API response received",
        url: apiUrl,
        status: 200,
        latencyInMs: expect.anything(),
      })
    );

    expect(mockMetricsHelper.captureResponseLatency).toHaveBeenCalledWith(expect.any(Number), "OTGHandler");
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
      ok: true,
    });

    await expect(() => getTokenFromOtg(...mockParams)).rejects.toThrow(
      new Error("OTG returned an expired Bearer Token")
    );
  });
});
