import { AuditConfig, HmrcEnvVars, TableNames } from "../../src/types/input";
import { HmrcApiConfig, NinoCheckFunctionConfig } from "../../src/helpers/function-config";

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
