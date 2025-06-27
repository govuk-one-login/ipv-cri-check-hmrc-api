jest.mock("../../../common/src/util/logger");
jest.mock("../../../common/src/util/metrics");
import { mockSaveRes } from "../mocks/mockConfig";
import * as ssmModule from "@aws-lambda-powertools/parameters/ssm";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { getHmrcConfig, handlePdvResponse, saveAttempt, saveTxn } from "../../src/helpers/nino";
import { mockPdvRes, mockSession, mockSessionId, mockTxn } from "../mocks/mockData";
import { captureMetric } from "../../../common/src/util/metrics";
import { logger } from "../../../common/src/util/logger";

const ddbMock = mockClient(DynamoDBClient);
ddbMock.on(PutItemCommand).resolves(mockSaveRes);
ddbMock.on(UpdateItemCommand).resolves(mockSaveRes);

const mockDynamoClient = ddbMock as unknown as DynamoDBClient;

describe("getHmrcConfig()", () => {
  const mockClientId = "my-cool-client";
  const pdvParamName = "big-ssm-param";

  const ssmRes = {
    [`/check-hmrc-cri-api/OtgUrl/${mockClientId}`]: "https://otg.hmrc.gov.uk",
    [`/check-hmrc-cri-api/NinoCheckUrl/${mockClientId}`]: "https://pdv.hmrc.gov.uk",
    [pdvParamName]: "billybob",
  };

  const getParametersByName = jest.spyOn(ssmModule, "getParametersByName");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("behaves as expected when the SSM fetch works", async () => {
    getParametersByName.mockResolvedValue(ssmRes);

    const config = await getHmrcConfig(mockClientId, pdvParamName);

    expect(getParametersByName).toHaveBeenCalledWith(
      {
        [`/check-hmrc-cri-api/OtgUrl/${mockClientId}`]: {},
        [`/check-hmrc-cri-api/NinoCheckUrl/${mockClientId}`]: {},
        [pdvParamName]: {},
      },
      { maxAge: 300, throwOnError: false }
    );

    expect(config).toEqual({
      otg: {
        apiUrl: "https://otg.hmrc.gov.uk",
      },
      pdv: {
        apiUrl: "https://pdv.hmrc.gov.uk",
        userAgent: "billybob",
      },
    });
  });

  it("throws an error when the SSM fetch returns errors", async () => {
    getParametersByName.mockResolvedValue({ ...ssmRes, _errors: ["ssm", "machine", "broke"] });

    await expect(() => getHmrcConfig(mockClientId, pdvParamName)).rejects.toThrow("ssm, machine, broke");
  });
});

describe("saveTxn()", () => {
  const sessionTableName = "big-session-gang";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("works correctly with valid input", async () => {
    await saveTxn(mockDynamoClient, sessionTableName, mockSessionId, mockTxn);

    expect(ddbMock).toHaveReceivedCommandWith(UpdateItemCommand, {
      TableName: sessionTableName,
      Key: {
        sessionId: {
          S: mockSessionId,
        },
      },
      UpdateExpression: "SET txn=:txn",
      ExpressionAttributeValues: {
        [":txn"]: {
          S: mockTxn,
        },
      },
    });
  });
});

describe("saveAttempt()", () => {
  const attemptTableName = "attempt-zone";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("works correctly with valid input", async () => {
    await saveAttempt(mockDynamoClient, attemptTableName, mockSession, mockPdvRes);

    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: attemptTableName,
      Item: {
        sessionId: {
          S: mockSession.sessionId,
        },
        timestamp: {
          S: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        },
        status: {
          S: String(mockPdvRes.httpStatus),
        },
        attempt: { S: "PASS" },
        ttl: { N: String(mockSession.expiryDate) },
      },
    });
  });
});

describe("handlePdvResponse()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles a valid response correctly", () => {
    const match = handlePdvResponse(mockPdvRes);

    expect(match).toEqual(true);

    expect(captureMetric).toHaveBeenCalledWith("SuccessfulFirstAttemptMetric");
  });

  it("handles a deceased response correctly", () => {
    const match = handlePdvResponse({
      ...mockPdvRes,
      httpStatus: 424,
      parsedBody: undefined,
      body: "something about the user being deceased",
    });

    expect(match).toEqual(false);

    expect(captureMetric).toHaveBeenCalledWith("DeceasedUserMetric");
  });

  it("handles a failed match response correctly", () => {
    const body = { errors: "this person is fake news" };

    const match = handlePdvResponse({
      ...mockPdvRes,
      httpStatus: 401,
      parsedBody: body,
      body: JSON.stringify(body),
    });

    expect(match).toEqual(false);

    expect(captureMetric).toHaveBeenCalledWith("RetryAttemptsSentMetric");
  });

  it("handles an invalid credentials response correctly", () => {
    let thrown = false;

    const body = {
      code: "INVALID_CREDENTIALS",
      message: "bruh",
    } as const;

    try {
      handlePdvResponse({ ...mockPdvRes, httpStatus: 400, parsedBody: body, body: JSON.stringify(body) });
    } catch (error) {
      thrown = true;

      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(captureMetric).toHaveBeenCalledWith("FailedHMRCAuthMetric");
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("400"));
  });

  it("handles an unexpected PDV API error correctly", () => {
    let thrown = false;

    try {
      handlePdvResponse({ ...mockPdvRes, httpStatus: 999 });
    } catch (error) {
      thrown = true;

      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(captureMetric).toHaveBeenCalledWith("HMRCAPIErrorMetric");
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("999"));
  });

  it("handles a PDV API error with no valid JSON body correctly", () => {
    let thrown = false;

    try {
      handlePdvResponse({ ...mockPdvRes, httpStatus: 401, parsedBody: undefined });
    } catch (error) {
      thrown = true;

      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(captureMetric).toHaveBeenCalledWith("HMRCAPIErrorMetric");
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("401"));
  });
});
