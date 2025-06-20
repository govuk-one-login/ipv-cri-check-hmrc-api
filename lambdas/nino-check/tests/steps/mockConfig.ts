import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { mockLogHelper } from "../../../common/tests/logger";
import { mockMetricsHelper } from "../../../common/tests/metrics-helper";
import { AuditConfig, Helpers, HmrcEnvVars, NinoCheckFunctionConfig, TableNames } from "../../src/types/input";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

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
  deviceInformation: mockDeviceInformationHeader,
};

export const mockHmrcEnvVars: HmrcEnvVars = {
  pdvUserAgentParamName: "user-agent-param",
};

export const mockFunctionConfig: NinoCheckFunctionConfig = {
  tableNames: mockTableNames,
  audit: mockAuditConfig,
  hmrcApi: mockHmrcEnvVars,
};

export const mockEventBridgeClient = {
  send: jest.fn(),
} as unknown as EventBridgeClient;

export const mockDynamoClient = {
  send: jest.fn(),
} as unknown as DynamoDBClient;

export const mockHelpers: Helpers = {
  logHelper: mockLogHelper,
  metricsHelper: mockMetricsHelper,
  eventsClient: mockEventBridgeClient,
  dynamoClient: mockDynamoClient,
};
