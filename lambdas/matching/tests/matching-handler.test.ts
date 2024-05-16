import { MatchingHandler } from "../src/matching-handler";
import { MatchEvent } from "../src/match-event";
import { Context } from "aws-lambda";

describe("matching-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return a matching response for a given nino and user", async () => {
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("application/json"),
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
    const event = {
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
      user: { govuk_signin_journey_id: "test-government-journey-id"}
    } as MatchEvent;
    const result = await matchingHandler.handler(event, {} as Context);
    expect(result.status).toBe("200");
    expect(result.body).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dateOfBirth: "1948-04-23",
      nino: "AA000003D",
    });
  });
  it("should return text when content type is not json", async () => {
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });
    const matchingHandler = new MatchingHandler();
    const event = {
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
      user: { govuk_signin_journey_id: "test-government-journey-id"}
    } as MatchEvent;
    const result = await matchingHandler.handler(event, {} as Context);
    expect(result.status).toBe("200");
    expect(result.body).toStrictEqual("Test Text");
  });

  it("should return an error message when has no content-type and has no body", async () => {
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce(""),
      },
      status: 200,
    });
    const matchingHandler = new MatchingHandler();
    const event = {
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
      user: { govuk_signin_journey_id: "test-government-journey-id"}
    } as MatchEvent;

    await expect(
      matchingHandler.handler(event, {} as Context)
    ).rejects.toThrow();
  });
});
