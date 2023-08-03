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
        nino: "AA000003D"
      }),
    });
    const matchingHandler = new MatchingHandler();
    const event = {
      userDetails: {
        firstName: "Jim",
        lastName: "Ferguson",
        dob: "1948-04-23",
        nino: "AA000003D"
      },
      apiURL: {
        value: "https://hmrc/api"
      },
      userAgent: {
        value: "govuk-one-login"
      },
      oAuthToken: {
        value: "123456789"
      }
    };
    const result = await matchingHandler.handler(event, {} as Context);
    expect(result).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dob: "1948-04-23",
      nino: "AA000003D"
    });
  });

});
