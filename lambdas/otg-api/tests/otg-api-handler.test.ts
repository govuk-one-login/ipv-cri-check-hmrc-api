import { Context } from "aws-lambda";
import { OTGApiHandler } from "../src/otg-api-handler";

const mockGovJourneyId = "test-government-journey-id"

describe("otg-api-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return a token and expiry", async () => {
    const mockToken = "goodToken";
    const mockExpiry = Date.now() + 600000;

    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce({
        token: mockToken,
        expiry: mockExpiry
      }),
      ok: true
    });

    const otgApiHandler = new OTGApiHandler();
    const event = {
      apiURL: "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub",
      govJourneyId: mockGovJourneyId
    };
    const result = await otgApiHandler.handler(event, {} as Context);
    expect(result.token).toBe(mockToken);
    expect(result.expiry).toBe(mockExpiry);
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
      apiURL: "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub",
      govJourneyId: mockGovJourneyId
    };

    await expect(() => otgApiHandler.handler(event, {})).rejects.toThrow(
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
        expiry: mockExpiry
      }),
      ok: true
    });

    const otgApiHandler = new OTGApiHandler();
    const event = {
      apiURL: "https://apigwId-vpceId.execute-api.eu-west-2.amazonaws.com/dev/token/?tokenType=stub",
      govJourneyId: mockGovJourneyId
    };

    await expect(() => otgApiHandler.handler(event, {})).rejects.toThrow(
      new Error("OTG returned an expired Bearer Token")
    );
  });

});
