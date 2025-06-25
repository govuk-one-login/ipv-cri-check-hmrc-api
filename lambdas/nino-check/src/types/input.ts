import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { MetricsHelper } from "../../../logging/metrics-helper";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { ISO8601DateString } from "../../../common/src/types/brands";
import { Logger } from "@aws-lambda-powertools/logger";

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

export type InputBody = {
  nino: string;
};

export type Helpers = {
  logger: Logger;
  metricsHelper: MetricsHelper;
  eventsClient: EventBridgeClient;
  dynamoClient: DynamoDBClient;
  functionStartTime: ISO8601DateString;
};
