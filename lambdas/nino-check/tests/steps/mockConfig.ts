import { mockLogHelper } from "../../../common/tests/logger";
import { mockMetricsHelper } from "../../../common/tests/metrics-helper";
import {
  Helpers,
  HmrcApiConfig,
  NinoCheckConfig,
  TableNames,
} from "../../src/types/input";

export const validHmrcConfig: HmrcApiConfig = {
  otg: {
    apiUrl: "https://otg.hmrc.gov.uk",
  },
  pdv: {
    apiUrl: "https://pdv.hmrc.gov.uk",
    userAgent: "billybob",
  },
};

export const validTableNames: TableNames = {
  sessionTable: "blah",
  personIdentityTable: "yep",
  attemptTable: "no",
  ninoUserTable: "maybe",
};

export const validNinoCheckFnConfig: NinoCheckConfig = {
  hmrcApiConfig: validHmrcConfig,
  tableNames: validTableNames,
};

export const mockHelpers: Helpers = {
  logHelper: mockLogHelper,
  metricsHelper: mockMetricsHelper,
};
