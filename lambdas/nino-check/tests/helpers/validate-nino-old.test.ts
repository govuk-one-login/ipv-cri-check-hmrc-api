import * as otgModule from "../../src/hmrc-apis/otg";
import * as pdvModule from "../../src/hmrc-apis/pdv";
import { mockFunctionConfig, mockSaveRes, mockTableNames } from "../mocks/mockConfig";
import { mockNino, mockPersonIdentity, mockSession } from "../mocks/mockData";
import { PdvFunctionOutput } from "../../src/hmrc-apis/types/pdv";
import * as ssmModule from "@aws-lambda-powertools/parameters/ssm";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { CriError } from "../../../common/src/errors/cri-error";

const getTokenFromOtg = jest.spyOn(otgModule, "getTokenFromOtg");
const matchUserDetailsWithPdv = jest.spyOn(pdvModule, "matchUserDetailsWithPdv");
const getParametersByName = jest.spyOn(ssmModule, "getParametersByName");

const mockDynamoClient = mockClient(DynamoDBClient);
mockDynamoClient.on(PutItemCommand).resolves(mockSaveRes);
mockDynamoClient.on(UpdateItemCommand).resolves(mockSaveRes);

const mockOtgToken = "gimme access";

const mockPdvRes = {
  httpStatus: 200,
  body: "cool stuff",
  parsedBody: {
    firstName: "bob",
    lastName: "jenkins",
    nino: "AA123456B",
    dateOfBirth: "1994-09-24",
  },
  txn: "good",
};

const mockClientId = "my-cool-client";

describe("NINo Check function validateNino()", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getParametersByName.mockResolvedValue({
      "/check-hmrc-cri-api/OtgUrl/${clientId}": "https://otg.hmrc.gov.uk",
      "/check-hmrc-cri-api/NinoCheckUrl/${clientId}": "https://pdv.hmrc.gov.uk",
      "user-agent-param-name": "billybob",
    });
    getTokenFromOtg.mockResolvedValue(mockOtgToken);
    matchUserDetailsWithPdv.mockResolvedValue(mockPdvRes);

    mockDynamoClient.resetHistory();
  });

  it("works as expected with normal inputs", async () => {
    const result = await handleNinoResponse(
      mockClientId,
      mockFunctionConfig,
      mockHelpers,
      mockPersonIdentity,
      mockSession,
      mockNino
    );

    expect(getParametersByName).toHaveBeenCalledWith(
      {
        [`/check-hmrc-cri-api/OtgUrl/${mockClientId}`]: {},
        [`/check-hmrc-cri-api/NinoCheckUrl/${mockClientId}`]: {},
        [mockFunctionConfig.hmrcApi.pdvUserAgentParamName]: {},
      },
      { maxAge: 300, throwOnError: false }
    );
    expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(`SuccessfulFirstAttemptMetric`);

    expect(mockDynamoClient).toHaveReceivedCommandWith(UpdateItemCommand, {
      TableName: mockTableNames.sessionTable,
      Key: { sessionId: { S: mockSession.sessionId } },
      UpdateExpression: `SET txn=:txn`,
      ExpressionAttributeValues: {
        ":txn": {
          S: mockPdvRes.txn,
        },
      },
    });

    expect(mockDynamoClient).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: mockTableNames.attemptTable,
      Item: {
        sessionId: {
          S: mockSession.sessionId,
        },
        timestamp: {
          S: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        },
        attempt: { S: "PASS" },
        ttl: { N: String(mockSession.expiryDate) },
      },
    });
    expect(result).toEqual({ ninoMatch: true });
    expect(mockHelpers.eventsClient.send).toHaveBeenCalledTimes(2);
    expect(mockHelpers.eventsClient.send).toHaveBeenCalledWith(
      new PutEventsCommand({
        Entries: [
          expect.objectContaining({
            EventBusName: mockFunctionConfig.audit.eventBus,
            Source: mockFunctionConfig.audit.source,
            DetailType: "REQUEST_SENT",
            Detail: expect.stringContaining("IPV_HMRC_RECORD_CHECK_CRI"),
          }),
        ],
      })
    );
    expect(mockHelpers.eventsClient.send).toHaveBeenCalledWith(
      new PutEventsCommand({
        Entries: [
          expect.objectContaining({
            EventBusName: mockFunctionConfig.audit.eventBus,
            Source: mockFunctionConfig.audit.source,
            DetailType: "RESPONSE_RECEIVED",
            Detail: expect.stringContaining("IPV_HMRC_RECORD_CHECK_CRI"),
          }),
        ],
      })
    );
  });

  it("throws if getParametersByName() fails", async () => {
    getParametersByName.mockResolvedValue({
      _errors: ["bad stuff happened", "oh no!"],
    });

    await expect(
      handleNinoResponse(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
    ).rejects.toThrow(Error);
  });

  it("handles OTG execution errors correctly", async () => {
    const otgError = new Error(`Error response received from OTG 500 Internal Server Error`);
    getTokenFromOtg.mockImplementation(() => {
      throw otgError;
    });

    await expect(
      handleNinoResponse(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
    ).rejects.toThrow(otgError);

    expect(matchUserDetailsWithPdv).not.toHaveBeenCalled();
  });

  it("handles PDV execution errors correctly", async () => {
    getTokenFromOtg.mockResolvedValue(mockOtgToken);

    const pdvError = new Error(`First Name is blank`);
    matchUserDetailsWithPdv.mockImplementation(() => {
      throw pdvError;
    });

    await expect(
      handleNinoResponse(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
    ).rejects.toThrow(pdvError);

    expect(mockDynamoClient).not.toHaveReceivedAnyCommand();
  });

  it("handles errors from the PDV API correctly", async () => {
    getTokenFromOtg.mockResolvedValue(mockOtgToken);

    const dummyPdvBody: Omit<PdvFunctionOutput, "httpStatus"> = {
      body: "{ bad: true }",
      txn: "no!",
    };

    const cases: {
      pdvBody: PdvFunctionOutput;
      metricName?: string;
      error?: Error;
    }[] = [
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 424,
        },
        metricName: "DeceasedUserMetric",
      },
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 401,
          parsedBody: {
            errors: "something bad",
          },
        },
      },
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 401,
          parsedBody: {
            code: "INVALID_CREDENTIALS",
            message: "no!",
          },
        },
        metricName: "FailedHMRCAuthMetric",
        error: new CriError(500, "Failed to authenticate with HMRC API"),
      },
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 500,
        },
        metricName: "HMRCAPIErrorMetric",
        error: new CriError(500, "Unexpected error with the PDV API"),
      },
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 401,
        },
        metricName: "HMRCAPIErrorMetric",
        error: new CriError(500, "Unexpected error with the PDV API"),
      },
    ];

    for (const { pdvBody, metricName, error } of cases) {
      matchUserDetailsWithPdv.mockResolvedValue(pdvBody);
      mockDynamoClient.resetHistory();

      if (error) {
        await expect(
          handleNinoResponse(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
        ).rejects.toThrow(error);

        expect(mockDynamoClient).not.toHaveReceivedAnyCommand();
      } else {
        const res = await handleNinoResponse(
          mockClientId,
          mockFunctionConfig,
          mockHelpers,
          mockPersonIdentity,
          mockSession,
          mockNino
        );
        expect(res).toStrictEqual({ ninoMatch: false });
      }

      if (metricName) {
        expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(metricName);
        (mockHelpers.metricsHelper.captureMetric as jest.Mock).mockReset();
      }
    }
  });
});
