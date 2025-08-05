import { BaseFunctionConfig } from "../../src/config/base-function-config";
import { AuditConfig } from "../../src/types/audit";

export const mockDeviceInformationHeader = "big-device-time";

export const mockAuditConfig: AuditConfig = {
  queueUrl: "cool-queuez.com",
  componentId: "https://check-hmrc-time.account.gov.uk",
};

export const mockFunctionConfig: BaseFunctionConfig = {
  tableNames: { sessionTable: "session-table" },
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
