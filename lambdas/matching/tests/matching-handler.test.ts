import { MatchingHandler, logger } from "../src/matching-handler";
import { MatchEvent } from "../src/match-event";
import { Context } from "aws-lambda";

jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    appendKeys: jest.fn(),
  })),
}));

describe("matching-handler", () => {
  let testEvent: MatchEvent;

  beforeEach(() => {
    global.fetch = jest.fn();
    testEvent = {
      sessionId: "12346",
      nino: "AA000003D",
      userDetails: {
        firstName: "Jim",
        lastName: "Ferguson",
        dob: "1948-04-23",
        nino: "AA000003D",
      },
      userAgent: "govuk-one-login",
      apiURL:
        "https://test-api.service.hmrc.gov.uk/individuals/authentication/authenticator/match",
      oAuthToken: "123",
      user: { govuk_signin_journey_id: "test-government-journey-id" },
    } as MatchEvent;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return a matching response for a given nino and user", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest
          .fn()
          .mockReturnValueOnce("mock-txn")
          .mockReturnValueOnce("application/json"),
      },
      json: jest.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dateOfBirth: "1948-04-23",
        nino: "AA000003D",
      }),
      status: 200,
    });

    const matchingHandler = new MatchingHandler();
    const result = await matchingHandler.handler(testEvent, {} as Context);

    expect(result.status).toBe("200");
    expect(result.body).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dateOfBirth: "1948-04-23",
      nino: "AA000003D",
    });
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should return text when content type is not json", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    const matchingHandler = new MatchingHandler();
    const result = await matchingHandler.handler(testEvent, {} as Context);

    expect(result.status).toBe("200");
    expect(result.body).toStrictEqual("Test Text");
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should return an error message when has no content-type and has no body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      status: 200,
    });
    const matchingHandler = new MatchingHandler();
    await expect(
      matchingHandler.handler(testEvent, {} as Context)
    ).rejects.toThrow();
  });

  it("should log API latency", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    const matchingHandler = new MatchingHandler();
    await matchingHandler.handler(testEvent, {} as Context);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "API response received",
        url: testEvent.apiURL,
        status: 200,
        latencyInMs: expect.anything(),
      })
    );
  });
});
