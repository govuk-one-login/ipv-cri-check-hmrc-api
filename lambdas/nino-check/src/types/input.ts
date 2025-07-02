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
};

export type HmrcEnvVars = {
  pdvUserAgentParamName: string;
};

export type InputBody = {
  nino: string;
};
