import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../common/src/util/logger");
vi.mock("../../../common/src/util/metrics");
import { mockSaveRes } from "../mocks/mockConfig";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-vitest/extend";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { getHmrcConfig, handleResponseAndSaveAttempt, saveTxn } from "../../src/helpers/nino";
import * as GetParameters from "../../../common/src/util/get-parameters";
import { mockPdvDeceasedRes, mockPdvErrorRes, mockPdvInvalidCredsRes, mockPdvRes } from "../mocks/mockData";
import { mockSession, mockSessionId, mockTxn } from "../../../common/tests/mocks/mockData";
import { captureMetric } from "../../../common/src/util/metrics";
import { logger } from "../../../common/src/util/logger";
import { CriError } from "../../../common/src/errors/cri-error";

const ddbMock = mockClient(DynamoDBClient);
ddbMock.on(PutItemCommand).resolves(mockSaveRes);
ddbMock.on(UpdateItemCommand).resolves(mockSaveRes);

const mockDynamoClient = ddbMock as unknown as DynamoDBClient;

describe("getHmrcConfig()", () => {
  const mockClientId = "my-cool-client";

  const ssmRes = {
    [`/check-hmrc-cri-api/OtgUrl/${mockClientId}`]: "https://otg.hmrc.gov.uk",
    [`/check-hmrc-cri-api/NinoCheckUrl/${mockClientId}`]: "https://pdv.hmrc.gov.uk",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("behaves as expected when the SSM fetch works", async () => {
    const paramSpy = vi.spyOn(GetParameters, "getParametersValues").mockResolvedValueOnce(ssmRes);

    const config = await getHmrcConfig(mockClientId);

    expect(paramSpy).toHaveBeenCalledWith(
      ["/check-hmrc-cri-api/OtgUrl/my-cool-client", "/check-hmrc-cri-api/NinoCheckUrl/my-cool-client"],
      300
    );

    expect(config).toEqual({
      otg: {
        apiUrl: "https://otg.hmrc.gov.uk",
      },
      pdv: {
        apiUrl: "https://pdv.hmrc.gov.uk",
      },
    });
  });

  it("throws an error when the SSM fetch returns errors", async () => {
    vi.spyOn(GetParameters, "getParametersValues").mockRejectedValueOnce(
      new Error(
        "Following SSM parameters do not exist: [/check-hmrc-cri-api/OtgUrl/my-cool-client, /check-hmrc-cri-api/NinoCheckUrl/my-cool-client]"
      )
    );

    await expect(() => getHmrcConfig(mockClientId)).rejects.toThrow(
      new CriError(
        500,
        "Failed to load HMRC config: Following SSM parameters do not exist: [/check-hmrc-cri-api/OtgUrl/my-cool-client, /check-hmrc-cri-api/NinoCheckUrl/my-cool-client]"
      )
    );
  });
});

describe("saveTxn()", () => {
  const sessionTableName = "big-session-gang";

  beforeEach(() => {
    vi.clearAllMocks();
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

describe("handleResponseAndSaveAttempt()", () => {
  const attemptTableName = "attempt-zone";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles a valid response correctly", async () => {
    const match = await handleResponseAndSaveAttempt(mockDynamoClient, attemptTableName, mockSession, mockPdvRes);

    expect(match).toEqual(true);
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

  it("handles a deceased response correctly", async () => {
    const match = await handleResponseAndSaveAttempt(
      mockDynamoClient,
      attemptTableName,
      mockSession,
      mockPdvDeceasedRes
    );

    expect(match).toEqual(false);

    expect(captureMetric).toHaveBeenCalledWith("DeceasedUserMetric");
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
          S: String(mockPdvDeceasedRes.httpStatus),
        },
        text: {
          S: String(mockPdvDeceasedRes.errorBody),
        },
        attempt: { S: "FAIL" },
        ttl: { N: String(mockSession.expiryDate) },
      },
    });
  });

  it("handles a failed match response correctly", async () => {
    const match = await handleResponseAndSaveAttempt(mockDynamoClient, attemptTableName, mockSession, mockPdvErrorRes);

    expect(match).toEqual(false);
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
          S: String(mockPdvErrorRes.httpStatus),
        },
        text: {
          S: String(mockPdvErrorRes.errorBody.errorMessage),
        },
        attempt: { S: "FAIL" },
        ttl: { N: String(mockSession.expiryDate) },
      },
    });
  });

  it("handles an invalid credentials response correctly", async () => {
    let thrown = false;

    try {
      await handleResponseAndSaveAttempt(mockDynamoClient, attemptTableName, mockSession, mockPdvInvalidCredsRes);
    } catch (error) {
      thrown = true;

      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("400"));
  });

  it("handles an unexpected PDV API error correctly", async () => {
    let thrown = false;

    try {
      await handleResponseAndSaveAttempt(mockDynamoClient, attemptTableName, mockSession, {
        ...mockPdvRes,
        httpStatus: 999,
      });
    } catch (error) {
      thrown = true;

      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("999"));
  });
});
