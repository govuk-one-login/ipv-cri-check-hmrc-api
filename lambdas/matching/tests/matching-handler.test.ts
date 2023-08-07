import { MatchingHandler } from "../src/matching-handler";
import { Context } from "aws-lambda";

describe("matching-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return a matching response for a given nino and user", async () => {
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dob: "1948-04-23",
        nino: "AA000003D",
      }),
    });
    const matchingHandler = new MatchingHandler();
    const event = {
      sessionId: "12346",
      nino: "AA000003D",
      userDetails: {
        Count: 1,
        Items: [
          {
            firstName: {
              S: "Jim",
            },
            lastName: {
              S: "Ferguson",
            },
            dob: {
              S: "1948-04-23",
            },
            nino: {
              S: "AA000003D",
            },
          },
        ],
      },
      userAgent: {
        value: "govuk-one-login",
      },
      apiURL: {
        value:
          "https://test-api.service.hmrc.gov.uk/individuals/authentication/authenticator/match",
      },
      oAuthToken: {
        value: "d48c73a3f8712351a4d1db25bb4170a5",
      },
    } as MatchEvent;
    const result = await matchingHandler.handler(event, {} as Context);
    expect(result).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dob: "1948-04-23",
      nino: "AA000003D",
    });
  });
});
