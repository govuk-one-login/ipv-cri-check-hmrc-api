import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LogHelper } from "../../../logging/log-helper";
import { MetricsHelper } from "../../../logging/metrics-helper";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

export type TableNames = {
  sessionTable: string;
  personIdentityTable: string;
  attemptTable: string;
  ninoUserTable: string;
};

export type AuditConfig = {
  eventBus: string;
  source: string;
  issuer: string;
  deviceInformation?: string;
};

export type HmrcEnvVars = {
  pdvUserAgentParamName: string;
};

export type NinoCheckFunctionConfig = {
  tableNames: TableNames;
  audit: AuditConfig;
  hmrcApi: HmrcEnvVars;
};

export type InputBody = {
  nino: string;
};

export type Helpers = {
  logHelper: LogHelper;
  metricsHelper: MetricsHelper;
  eventsClient: EventBridgeClient;
  dynamoClient: DynamoDBClient;
};
