import { PersonIdentityItem, PersonIdentityNamePart } from "../../../common/src/database/types/person-identity";
import { mockLogger } from "../../../common/tests/logger";
import { mockMetricsHelper } from "../../../common/tests/metrics-helper";
import { buildPdvInput, matchUserDetailsWithPdv } from "../../src/hmrc-apis/pdv";
import { PdvApiInput } from "../../src/hmrc-apis/types/pdv";

const apiUrl = "https://test-api.service.hmrc.gov.uk/individuals/authentication/authenticator/match";
const userAgent = "govuk-one-login";
const oAuthToken = "123";
const dateOfBirth = "1948-04-23";
const nino = "AA000003D";
const pdvConfig = { apiUrl, userAgent };

const personIdentity: PersonIdentityItem = {
  sessionId: "12346",
  addresses: [],
  names: [
    {
      nameParts: [
        {
          type: "GivenName",
          value: "Jim",
        },
        {
          type: "FamilyName",
          value: "Ferguson",
        },
      ],
    },
  ],
  birthDates: [{ value: dateOfBirth }],
  expiryDate: Date.now(),
  socialSecurityRecord: undefined,
};

const pdvInput: PdvApiInput = {
  firstName: "Jim",
  lastName: "Ferguson",
  dateOfBirth,
  nino,
};

const mockInput = [pdvConfig, oAuthToken, pdvInput, mockLogger, mockMetricsHelper] as const;

global.fetch = jest.fn();

describe("matchUserDetailsWithPdv", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return a matching response for a given nino and user", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dateOfBirth: "1948-04-23",
        nino: "AA000003D",
      }),
      status: 200,
    });

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(result.httpStatus).toBe(200);
    expect(result.body).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dateOfBirth: "1948-04-23",
      nino: "AA000003D",
    });
    expect(result.txn).toStrictEqual("mock-txn");

    expect(mockMetricsHelper.captureResponseLatency).toHaveBeenCalledWith(expect.any(Number), "MatchingHandler");
  });

  it("does not fail if x-amz-cf-id header is unset", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce(undefined).mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce({
        firstName: "Jim",
        lastName: "Ferguson",
        dateOfBirth: "1948-04-23",
        nino: "AA000003D",
      }),
      status: 200,
    });

    const result2 = await matchUserDetailsWithPdv(...mockInput);

    expect(result2.httpStatus).toBe(200);
    expect(result2.body).toStrictEqual({
      firstName: "Jim",
      lastName: "Ferguson",
      dateOfBirth: "1948-04-23",
      nino: "AA000003D",
    });
    expect(result2.txn).toStrictEqual("");
  });

  it("should return 500 with internal server error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce("dummy-error-message-containing-pii"),
      status: 500,
    });

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(result.httpStatus).toBe(500);
    expect(result.body).toStrictEqual("Internal server error");
    expect(result.txn).toStrictEqual("mock-txn");
  });

  it("should return a valid response when the content-type is application/json and the body is not valid JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("content-type").mockReturnValueOnce("application/json"),
      },
      text: jest.fn().mockResolvedValueOnce("Request to create account for a deceased user"),
      status: 422,
    });

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(result.httpStatus).toBe(422);
    expect(result.body).toStrictEqual("Request to create account for a deceased user");
  });

  it("should return text when content type is not json", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    const result = await matchUserDetailsWithPdv(...mockInput);

    expect(result.httpStatus).toBe(200);
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
    await expect(matchUserDetailsWithPdv(...mockInput)).rejects.toThrow();
  });

  it("should log API latency, and push a metric", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      headers: {
        get: jest.fn().mockReturnValueOnce("mock-txn").mockReturnValueOnce(""),
      },
      text: jest.fn().mockResolvedValueOnce("Test Text"),
      status: 200,
    });

    await matchUserDetailsWithPdv(...mockInput);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PDV API response received",
        url: apiUrl,
        status: 200,
        latencyInMs: expect.anything(),
      })
    );

    expect(mockMetricsHelper.captureResponseLatency).toHaveBeenCalledWith(expect.any(Number), "MatchingHandler");
  });
});

describe("buildPdvInput", () => {
  it("should concat all provided FamilyNames", async () => {
    const firstName = "John";
    const lastName = "Alice Eve";

    // deep clone mock PI
    const manyFamilyNamesPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    manyFamilyNamesPersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: "John",
          },
          {
            type: "GivenName",
            value: "John",
          },
          {
            type: "FamilyName",
            value: "Alice",
          },
          {
            type: "FamilyName",
            value: "Eve",
          },
        ],
      },
    ];

    const result = buildPdvInput(manyFamilyNamesPersonIdentity, nino);

    expect(result).toStrictEqual({
      firstName,
      lastName,
      nino,
      dateOfBirth,
    });
  });

  it("should select only the first GivenName", async () => {
    const firstName = "TestFirstName";
    const lastName = "TestLastName";

    // deep clone mock PI
    const manyGivenNamesPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    manyGivenNamesPersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: firstName,
          },
          {
            type: "GivenName",
            value: "Bob",
          },
          {
            type: "FamilyName",
            value: lastName,
          },
        ],
      },
    ];

    const result = buildPdvInput(manyGivenNamesPersonIdentity, nino);

    expect(result).toStrictEqual({
      firstName,
      lastName,
      dateOfBirth,
      nino,
    });
  });

  it("should throw when GivenName is blank", async () => {
    // deep clone mock PI
    const blankFirstNamePersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    blankFirstNamePersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: "",
          },
          {
            type: "FamilyName",
            value: "TestLastName",
          },
        ],
      },
    ];

    expect(() => buildPdvInput(blankFirstNamePersonIdentity, nino)).toThrow(new Error("First Name is blank"));
  });

  it("should throw when FamilyName is blank", async () => {
    // deep clone mock PI
    const blankGivenNamePersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    blankGivenNamePersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: "TestFirstName",
          },
          {
            type: "GivenName",
            value: "",
          },
        ],
      },
    ];

    expect(() => buildPdvInput(blankGivenNamePersonIdentity, nino)).toThrow(new Error("Last Name is blank"));
  });

  it("should throw when no value for name part is provided", async () => {
    // deep clone mock PI
    const blankNamePartPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    blankNamePartPersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
          } as PersonIdentityNamePart,
          {
            type: "FamilyName",
            value: "test",
          },
        ],
      },
    ];

    expect(() => buildPdvInput(blankNamePartPersonIdentity, nino)).toThrow(new Error("First Name is blank"));
  });
});
