import { LogHelper } from "../../../logging/log-helper";
import { MetricsHelper } from "../../../logging/metrics-helper";

export type TableNames = {
  sessionTable: string;
  personIdentityTable: string;
  attemptTable: string;
  ninoUserTable: string;
};

export type OtgConfig = { apiUrl: string };

export type PdvConfig = { apiUrl: string; userAgent: string };

export type HmrcApiConfig = {
  otg: OtgConfig;
  pdv: PdvConfig;
};

export type NinoCheckConfig = {
  hmrcApiConfig: HmrcApiConfig;
  tableNames: TableNames;
};

export type InputEvent = {
  sessionId: string;
  govJourneyId: string;
  nino: string;
  clientId: string;
};

export type Helpers = {
  logHelper: LogHelper;
  metricsHelper: MetricsHelper;
};
