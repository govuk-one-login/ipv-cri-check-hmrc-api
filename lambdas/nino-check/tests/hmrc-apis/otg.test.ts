import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
vi.mock("../../../common/src/util/logger");
vi.mock("../../../common/src/util/metrics");
import { logger } from "../../../common/src/util/logger";
import { captureLatency } from "../../../common/src/util/metrics";
import { getTokenFromOtg } from "../../src/hmrc-apis/otg";

const apiUrl = "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub";

const mockParams = [{ apiUrl }] as const;

const latency = 1001;

(captureLatency as unknown as Mock).mockImplementation(async (_, callback) => [await callback(), latency]);

const mockToken = "goodToken";
const mockExpiry = Date.now() + 600000;

global.fetch = vi.fn();
(global.fetch as Mock).mockResolvedValueOnce({
  json: vi.fn().mockResolvedValueOnce({
    token: mockToken,
    expiry: mockExpiry,
  }),
  status: 200,
  ok: true,
});

describe("getTokenFromOtg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the token and log the outcome", async () => {
    const token = await getTokenFromOtg(...mockParams);
    expect(token).toBe(mockToken);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "OTG API response received",
        url: apiUrl,
        status: 200,
        latencyInMs: latency,
      })
    );
  });

  it("should throw when an invalid response is returned from OTG", async () => {
    global.fetch = vi.fn();
    (global.fetch as Mock).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValueOnce({}),
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

    global.fetch = vi.fn();
    (global.fetch as Mock).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValueOnce({
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
