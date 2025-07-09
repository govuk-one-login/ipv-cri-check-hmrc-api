import { HmrcEnvVars, NinoCheckFunctionConfig } from "../../src/helpers/function-config";
import { HmrcApiConfig } from "../../src/helpers/nino";
import { mockTableNames, mockAuditConfig } from "../../../common/tests/mocks/mockConfig";

export const mockDeviceInformationHeader = "big-device-time";

export const mockHmrcEnvVars: HmrcEnvVars = {
  pdvUserAgentParamName: "user-agent-param",
};

export const mockHmrcConfig: HmrcApiConfig = {
  otg: {
    apiUrl: "https://otg.hmrc.gov.uk",
  },
  pdv: {
    apiUrl: "https://pdv.hmrc.gov.uk",
    userAgent: "billybob",
  },
};

export const mockFunctionConfig: NinoCheckFunctionConfig = {
  tableNames: mockTableNames,
  audit: mockAuditConfig,
  hmrcApi: mockHmrcEnvVars,
};

export const mockSaveRes = {
  Attributes: {},
  ConsumedCapacity: {},
  ItemCollectionMetrics: {},
  $metadata: {
    httpStatusCode: 201,
  },
};
