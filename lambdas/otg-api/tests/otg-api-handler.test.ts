import { Context } from "aws-lambda";
import { OTGApiHandler } from "../src/otg-api-handler";

jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    appendKeys: jest.fn(),
    addContext: jest.fn(),
  })),
}));

const mockGovJourneyId = "test-government-journey-id";
const testEvent = {
  apiURL:
    "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub",
  govJourneyId: mockGovJourneyId,
};

describe("otg-api-handler", () => {
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

    const otgApiHandler = new OTGApiHandler();
    const result = await otgApiHandler.handler(testEvent, {} as Context);
    expect(result.token).toBe(mockToken);
    expect(result.expiry).toBe(mockExpiry);
  });

  it("should log API latency", async () => {
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

    const otgApiHandler = new OTGApiHandler();
    await otgApiHandler.handler(testEvent, {} as Context);

    expect(otgApiHandler.logger.info).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: "OTG API response received",
        url: testEvent.apiURL,
        status: 200,
        latencyInMs: expect.anything(),
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

    const otgApiHandler = new OTGApiHandler();
    const event = {
      apiURL:
        "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub",
      govJourneyId: mockGovJourneyId,
    };

    await expect(() =>
      otgApiHandler.handler(event, {} as Context)
    ).rejects.toThrow(
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

    const otgApiHandler = new OTGApiHandler();
    const event = {
      apiURL:
        "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub",
      govJourneyId: mockGovJourneyId,
    };

    await expect(() =>
      otgApiHandler.handler(event, {} as Context)
    ).rejects.toThrow(new Error("OTG returned an expired Bearer Token"));
  });
});
