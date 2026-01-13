import { NinoCheckFunctionConfig, TableNames } from "../../src/helpers/function-config";
import { mockAuditConfig } from "../../../common/tests/mocks/mockConfig";
import { HmrcApiConfig } from "../../../common/src/config/get-hmrc-config";

export const mockDeviceInformationHeader = "big-device-time";

export const mockTableNames: TableNames = {
  sessionTable: "session-table",
  personIdentityTable: "person-identity-table",
  attemptTable: "attempt-table",
  ninoUserTable: "nino-user-table",
};

export const mockHmrcConfig: HmrcApiConfig = {
  otg: {
    apiUrl: "https://otg.hmrc.gov.uk",
  },
  pdv: {
    apiUrl: "https://pdv.hmrc.gov.uk",
  },
};

export const mockFunctionConfig: NinoCheckFunctionConfig = {
  tableNames: mockTableNames,
  audit: mockAuditConfig,
};

export const mockSaveRes = {
  Attributes: {},
  ConsumedCapacity: {},
  ItemCollectionMetrics: {},
  $metadata: {
    httpStatusCode: 201,
  },
};
