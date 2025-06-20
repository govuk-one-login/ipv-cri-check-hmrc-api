import { UnixTimestamp } from "../../../common/src/types/brands";
import * as otgModule from "../../src/hmrc-apis/otg";
import * as pdvModule from "../../src/hmrc-apis/pdv";
import * as updateModule from "../../../common/src/database/update-record-by-session-id";
import * as insertModule from "../../../common/src/database/insert-record";
import { validateNino } from "../../src/steps/2-validate-nino";
import { mockDynamoClient, mockFunctionConfig, mockHelpers, mockTableNames } from "./mockConfig";
import { mockNino, mockPersonIdentity, mockPutObjectRes, mockSession } from "./mockRecords";
import { PdvFunctionOutput } from "../../src/hmrc-apis/types/pdv";
import {
  FailedAuthError,
  FailedMatchError,
  PdvApiError,
  PersonDeceasedError,
} from "../../src/hmrc-apis/exceptions/pdv";
import * as ssmModule from "@aws-lambda-powertools/parameters/ssm";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";

const getTokenFromOtg = jest.spyOn(otgModule, "getTokenFromOtg");
const matchUserDetailsWithPdv = jest.spyOn(pdvModule, "matchUserDetailsWithPdv");
const updateRecordBySessionId = jest.spyOn(updateModule, "updateRecordBySessionId");
const insertRecord = jest.spyOn(insertModule, "insertRecord");
const getParametersByName = jest.spyOn(ssmModule, "getParametersByName");
jest.mock("@aws-sdk/client-eventbridge");

const mockOtgRes = {
  token: "gimme access",
  expiry: 9999 as UnixTimestamp,
};

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
    getTokenFromOtg.mockResolvedValue(mockOtgRes);
    matchUserDetailsWithPdv.mockResolvedValue(mockPdvRes);
    updateRecordBySessionId.mockResolvedValue(mockPutObjectRes);
    insertRecord.mockResolvedValue(mockPutObjectRes);
    (PutEventsCommand as unknown as jest.Mock).mockImplementation((data) => ({
      payload: data,
    }));
  });

  it("works as expected with normal inputs", async () => {
    const result = await validateNino(
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
    expect(updateRecordBySessionId).toHaveBeenCalledWith(
      mockTableNames.sessionTable,
      { sessionId: mockSession.sessionId, txn: mockPdvRes.txn },
      mockHelpers.logHelper.logger,
      mockDynamoClient
    );
    expect(insertRecord).toHaveBeenCalledWith(
      mockTableNames.attemptTable,
      expect.objectContaining({
        sessionId: mockSession.sessionId,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        attempt: "PASS",
        ttl: mockSession.expiryDate,
      }),
      mockHelpers.logHelper.logger,
      mockDynamoClient
    );
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
      validateNino(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
    ).rejects.toThrow(Error);
  });

  it("handles OTG execution errors correctly", async () => {
    const otgError = new Error(`Error response received from OTG 500 Internal Server Error`);
    getTokenFromOtg.mockImplementation(() => {
      throw otgError;
    });

    await expect(
      validateNino(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
    ).rejects.toThrow(otgError);

    expect(mockHelpers.logHelper.logError).toHaveBeenLastCalledWith(String(otgError));
    expect(matchUserDetailsWithPdv).not.toHaveBeenCalled();
  });

  it("handles PDV execution errors correctly", async () => {
    getTokenFromOtg.mockResolvedValue(mockOtgRes);

    const pdvError = new Error(`First Name is blank`);
    matchUserDetailsWithPdv.mockImplementation(() => {
      throw pdvError;
    });

    await expect(
      validateNino(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
    ).rejects.toThrow(pdvError);

    expect(mockHelpers.logHelper.logError).toHaveBeenLastCalledWith(String(pdvError));
    expect(insertRecord).not.toHaveBeenCalled();
  });

  it("handles errors from the PDV API correctly", async () => {
    getTokenFromOtg.mockResolvedValue(mockOtgRes);

    const dummyPdvBody: Omit<PdvFunctionOutput, "httpStatus"> = {
      body: "{ bad: true }",
      txn: "no!",
    };

    const cases: {
      pdvBody: PdvFunctionOutput;
      metricName?: string;
      error: Error;
    }[] = [
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 424,
        },
        metricName: "DeceasedUserMetric",
        error: new PersonDeceasedError(),
      },
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 401,
          parsedBody: {
            errors: "something bad",
          },
        },
        error: new FailedMatchError(mockSession.sessionId),
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
        error: new FailedAuthError(),
      },
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 500,
        },
        metricName: "HMRCAPIErrorMetric",
        error: new PdvApiError(500),
      },
      {
        pdvBody: {
          ...dummyPdvBody,
          httpStatus: 401,
        },
        metricName: "HMRCAPIErrorMetric",
        error: new PdvApiError(401),
      },
    ];

    for (const { pdvBody, metricName, error } of cases) {
      matchUserDetailsWithPdv.mockResolvedValue(pdvBody);

      await expect(
        validateNino(mockClientId, mockFunctionConfig, mockHelpers, mockPersonIdentity, mockSession, mockNino)
      ).rejects.toThrow(error);

      if (metricName) {
        expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(metricName);
        (mockHelpers.metricsHelper.captureMetric as jest.Mock).mockReset();
      }
    }

    expect(insertRecord).not.toHaveBeenCalled();
  });
});
