import { mockLogger } from "../../../common/tests/logger";
vi.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
vi.mock("@govuk-one-login/cri-metrics");
import { logger } from "@govuk-one-login/cri-logger";
import { captureLatency } from "@govuk-one-login/cri-metrics";
import { getTokenFromOtg } from "../../src/hmrc-apis/otg";

const apiUrl = "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub";

const mockParams = [{ apiUrl }] as const;

const latencyInMs = 1001;

vi.mocked(captureLatency).mockImplementation(async (_, callback) => {
    const result = await callback();
    return { result, latencyInMs };
  });

const mockToken = "goodToken";
const mockExpiry = Date.now() + 600000;

global.fetch = vi.fn();
vi.mocked(global.fetch).mockResolvedValueOnce({
  json: vi.fn().mockResolvedValueOnce({
    token: mockToken,
    expiry: mockExpiry,
  }),
  status: 200,
  ok: true,
} as unknown as Response);

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
        latencyInMs,
      })
    );
  });

  it("should throw when an invalid response is returned from OTG", async () => {
    global.fetch = vi.fn();
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValueOnce({}),
      ok: false,
      status: 400,
      statusText: "Forbidden",
    } as unknown as Response);

    await expect(() => getTokenFromOtg(...mockParams)).rejects.toThrow(
      new Error("Error response received from OTG 400 Forbidden")
    );
  });

  it("should throw when the bearer token has expired", async () => {
    const mockToken = "goodToken";
    const mockExpiry = Date.now() - 600000;

    global.fetch = vi.fn();
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValueOnce({
        token: mockToken,
        expiry: mockExpiry,
      }),
      status: 200,
      ok: true,
    } as unknown as Response);

    await expect(() => getTokenFromOtg(...mockParams)).rejects.toThrow(
      new Error("OTG returned an expired Bearer Token")
    );
  });
});
