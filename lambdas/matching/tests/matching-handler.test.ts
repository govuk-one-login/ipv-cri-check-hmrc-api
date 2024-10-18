import { MatchingHandler, logger } from "../src/matching-handler";
import { MatchEvent } from "../src/match-event";
import { Context } from "aws-lambda";
import { Names } from "../src/name-part";

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
        names: {
          L: [
            {
              M: {
                nameParts: {
                  L: [
                    {
                      M: {
                        type: {
                          S: "GivenName",
                        },
                        value: {
                          S: "Jim",
                        },
                      },
                    },
                    {
                      M: {
                        type: {
                          S: "FamilyName",
                        },
                        value: {
                          S: "Ferguson",
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        } as Names,
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
      text: jest.fn().mockResolvedValueOnce({
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

  it("should return a valid response when the content-type is application/json and the body is not valid JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest
          .fn()
          .mockReturnValueOnce("content-type")
          .mockReturnValueOnce("application/json"),
      },
      text: jest
        .fn()
        .mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 422,
    });

    const matchingHandler = new MatchingHandler();
    const result = await matchingHandler.handler(testEvent, {} as Context);

    expect(result.status).toBe("422");
    expect(result.body).toStrictEqual(
      "Request to create account for a deceased user"
    );
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

  it("should concat all provided FamilyName", async () => {
    const firstName = "John";
    const lastName = "Alice Eve";
    const dob = "1948-04-23";
    const nino = "AA000003D";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest
          .fn()
          .mockReturnValueOnce("mock-txn")
          .mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce({
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: dob,
        nino: nino,
      }),
      status: 200,
    });

    const names = {
      L: [
        {
          M: {
            nameParts: {
              L: [
                {
                  M: {
                    type: {
                      S: "GivenName",
                    },
                    value: {
                      S: firstName,
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "GivenName",
                    },
                    value: {
                      S: "John",
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "FamilyName",
                    },
                    value: {
                      S: "Alice",
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "FamilyName",
                    },
                    value: {
                      S: "Eve",
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    } as Names;

    const handler = new MatchingHandler();
    const result = await handler.handler(
      {
        sessionId: "abc",
        nino: nino,
        userDetails: {
          names: names,
          dob: dob,
          nino: nino,
        },
        userAgent: "dummy",
        apiURL: "dummy",
        oAuthToken: "dummy",
        user: {
          govuk_signin_journey_id: "dummy",
        },
      },
      {} as Context
    );

    expect(result.status).toBe("200");
    expect(result.body).toStrictEqual({
      dateOfBirth: dob,
      firstName: firstName,
      lastName: lastName,
      nino: nino,
    });

    expect(global.fetch).toHaveBeenCalledWith("dummy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "dummy",
        Authorization: "Bearer dummy",
      },
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: dob,
        nino: nino,
      }),
    });
  });

  it("should select only the first GivenName", async () => {
    const firstName = "TestFirstName";
    const lastName = "TestLastName";
    const dob = "1948-04-23";
    const nino = "AA000003D";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest
          .fn()
          .mockReturnValueOnce("mock-txn")
          .mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce({
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: dob,
        nino: nino,
      }),
      status: 200,
    });

    const names = {
      L: [
        {
          M: {
            nameParts: {
              L: [
                {
                  M: {
                    type: {
                      S: "GivenName",
                    },
                    value: {
                      S: firstName,
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "GivenName",
                    },
                    value: {
                      S: "Bob",
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "FamilyName",
                    },
                    value: {
                      S: lastName,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    } as Names;

    const handler = new MatchingHandler();
    const result = await handler.handler(
      {
        sessionId: "abc",
        nino: nino,
        userDetails: {
          names: names,
          dob: dob,
          nino: nino,
        },
        userAgent: "dummy",
        apiURL: "dummy",
        oAuthToken: "dummy",
        user: {
          govuk_signin_journey_id: "dummy",
        },
      },
      {} as Context
    );

    expect(result.status).toBe("200");
    expect(result.body).toStrictEqual({
      dateOfBirth: dob,
      firstName: firstName,
      lastName: lastName,
      nino: nino,
    });

    expect(global.fetch).toHaveBeenCalledWith("dummy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "dummy",
        Authorization: "Bearer dummy",
      },
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: dob,
        nino: nino,
      }),
    });
  });

  it("should throw when firstName is blank", async () => {
    const firstName = "";
    const lastName = "TestLastName";
    const dob = "1948-04-23";
    const nino = "AA000003D";
    const names = {
      L: [
        {
          M: {
            nameParts: {
              L: [
                {
                  M: {
                    type: {
                      S: "GivenName",
                    },
                    value: {
                      S: firstName,
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "FamilyName",
                    },
                    value: {
                      S: lastName,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    } as Names;

    const handler = new MatchingHandler();
    await expect(async () =>
      handler.handler(
        {
          sessionId: "abc",
          nino: nino,
          userDetails: {
            names: names,
            dob: dob,
            nino: nino,
          },
          userAgent: "dummy",
          apiURL: "dummy",
          oAuthToken: "dummy",
          user: {
            govuk_signin_journey_id: "dummy",
          },
        },
        {} as Context
      )
    ).rejects.toThrow(new Error("First Name is blank"));
  });

  it("should throw when lastName is blank", async () => {
    const firstName = "TestFirstName";
    const lastName = "";
    const dob = "1948-04-23";
    const nino = "AA000003D";
    const names = {
      L: [
        {
          M: {
            nameParts: {
              L: [
                {
                  M: {
                    type: {
                      S: "GivenName",
                    },
                    value: {
                      S: firstName,
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "FamilyName",
                    },
                    value: {
                      S: lastName,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    } as Names;

    const handler = new MatchingHandler();
    await expect(async () =>
      handler.handler(
        {
          sessionId: "abc",
          nino: nino,
          userDetails: {
            names: names,
            dob: dob,
            nino: nino,
          },
          userAgent: "dummy",
          apiURL: "dummy",
          oAuthToken: "dummy",
          user: {
            govuk_signin_journey_id: "dummy",
          },
        },
        {} as Context
      )
    ).rejects.toThrow(new Error("Last Name is blank"));
  });

  it("should throw when no value for name part is provided", async () => {
    const lastName = "test";
    const dob = "1948-04-23";
    const nino = "AA000003D";

    const names = {
      L: [
        {
          M: {
            nameParts: {
              L: [
                {
                  M: {
                    type: {
                      S: "GivenName",
                    },
                  },
                },
                {
                  M: {
                    type: {
                      S: "FamilyName",
                    },
                    value: {
                      S: lastName,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    } as Names;

    const handler = new MatchingHandler();
    await expect(async () =>
      handler.handler(
        {
          sessionId: "abc",
          nino: nino,
          userDetails: {
            names: names,
            dob: dob,
            nino: nino,
          },
          userAgent: "dummy",
          apiURL: "dummy",
          oAuthToken: "dummy",
          user: {
            govuk_signin_journey_id: "dummy",
          },
        },
        {} as Context
      )
    ).rejects.toThrow(new Error("First Name is blank"));
  });
});
