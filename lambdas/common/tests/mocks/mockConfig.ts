import { AuditConfig, BaseFunctionConfig, TableNames } from "../../src/config/base-function-config";

export const mockTableNames: TableNames = {
  sessionTable: "session-table",
  personIdentityTable: "person-identity-table",
  attemptTable: "attempt-table",
  ninoUserTable: "nino-user-table",
};

export const mockDeviceInformationHeader = "big-device-time";

export const mockAuditConfig: AuditConfig = {
  eventBus: "audit-event-bus",
  source: "audit-source",
  issuer: "audit-issuer",
};

export const mockFunctionConfig: BaseFunctionConfig = {
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
