import { UnixTimestamp } from "../../../common/src/types/brands";
import * as otgModule from "../../src/hmrc-apis/otg";
import * as pdvModule from "../../src/hmrc-apis/pdv";
import * as updateModule from "../../../common/src/database/update-record-by-session-id";
import * as insertModule from "../../../common/src/database/insert-record";
import { validateNino } from "../../src/steps/2-validate-nino";
import { mockHelpers, validNinoCheckFnConfig } from "./mockConfig";
import { mockNino, mockPersonIdentity, mockSession } from "./mockRecords";

const getTokenFromOtg = jest.spyOn(otgModule, "getTokenFromOtg");
const matchUserDetailsWithPdv = jest.spyOn(
  pdvModule,
  "matchUserDetailsWithPdv"
);
const updateRecordBySessionId = jest.spyOn(
  updateModule,
  "updateRecordBySessionId"
);
const insertRecord = jest.spyOn(insertModule, "insertRecord");

const mockOtgRes = {
  token: "gimme access",
  expiry: 9999 as UnixTimestamp,
};

const mockPdvRes = {
  httpStatus: 200,
  body: "cool stuff",
  parsedBody: {
    id: "person 1",
    validationStatus: "success" as const,
    personalDetails: {
      firstName: "bob",
      lastName: "jenkins",
      nino: "AA123456B",
      dateOfBirth: "1994-09-24",
    },
  },
  txn: "good",
};

const mockPutObjectRes = {
  Attributes: {},
  ConsumedCapacity: {},
  ItemCollectionMetrics: {},
  $metadata: {
    httpStatusCode: 201,
  },
};

describe("NINo Check function validateNino()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("works as expected with normal inputs", async () => {
    getTokenFromOtg.mockResolvedValue(mockOtgRes);
    matchUserDetailsWithPdv.mockResolvedValue(mockPdvRes);
    updateRecordBySessionId.mockResolvedValue(mockPutObjectRes);
    insertRecord.mockResolvedValue(mockPutObjectRes);

    const result = await validateNino(
      validNinoCheckFnConfig,
      mockHelpers,
      mockPersonIdentity,
      mockSession,
      mockNino
    );

    expect(result).toEqual({ ninoMatch: true });
    expect(mockHelpers.metricsHelper.captureMetric).toHaveBeenCalledWith(
      `SuccessfulFirstAttemptMetric`
    );

    // TODO: expect events to have been pushed
  });
});
