import { AuditConfig, HmrcEnvVars, TableNames } from "../types/input";

const envVarNames = {
  sessionTable: "SESSION_TABLE",
  personIdentityTable: "PERSON_IDENTITY_TABLE",
  attemptTable: "ATTEMPT_TABLE",
  ninoUserTable: "NINO_USER_TABLE",
  auditEventBus: "AUDIT_EVENT_BUS",
  auditSource: "AUDIT_SOURCE",
  auditIssuer: "AUDIT_ISSUER",
  pdvUserAgentParamName: "PDV_USER_AGENT_PARAM_NAME",
};

export class NinoCheckFunctionConfig {
  public readonly tableNames: TableNames;
  public readonly audit: AuditConfig;
  public readonly hmrcApi: HmrcEnvVars;

  constructor({ deviceInformationHeader }: { deviceInformationHeader?: string }) {
    Object.values(envVarNames).forEach((name) => {
      if (!process.env[name]) {
        throw new Error(`Missing required environment variable at init: ${name}`);
      }
    });

    this.tableNames = {
      sessionTable: process.env[envVarNames.sessionTable] as string,
      personIdentityTable: process.env[envVarNames.personIdentityTable] as string,
      attemptTable: process.env[envVarNames.attemptTable] as string,
      ninoUserTable: process.env[envVarNames.ninoUserTable] as string,
    };
    this.audit = {
      eventBus: process.env[envVarNames.auditEventBus] as string,
      source: process.env[envVarNames.auditSource] as string,
      issuer: process.env[envVarNames.auditIssuer] as string,
      deviceInformation: deviceInformationHeader,
    };
    this.hmrcApi = {
      pdvUserAgentParamName: process.env[envVarNames.pdvUserAgentParamName] as string,
    };
  }
}
