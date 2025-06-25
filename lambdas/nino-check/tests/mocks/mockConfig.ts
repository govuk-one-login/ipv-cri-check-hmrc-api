import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { mockMetricsHelper } from "../../../common/tests/metrics-helper";
import { AuditConfig, Helpers, HmrcEnvVars, TableNames } from "../../src/types/input";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockLogger } from "../../../common/tests/logger";
import { ISO8601DateString } from "../../../common/src/types/brands";
import { NinoCheckFunctionConfig } from "../../src/helpers/function-config";

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
  logger: mockLogger,
  metricsHelper: mockMetricsHelper,
  eventsClient: mockEventBridgeClient,
  dynamoClient: mockDynamoClient,
  functionStartTime: new Date().toISOString() as ISO8601DateString,
};

export const mockSaveRes = {
  Attributes: {},
  ConsumedCapacity: {},
  ItemCollectionMetrics: {},
  $metadata: {
    httpStatusCode: 201,
  },
};
