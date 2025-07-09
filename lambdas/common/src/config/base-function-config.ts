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

const envVarNames = {
  sessionTable: "SESSION_TABLE",
  personIdentityTable: "PERSON_IDENTITY_TABLE",
  attemptTable: "ATTEMPT_TABLE",
  ninoUserTable: "NINO_USER_TABLE",
  auditEventBus: "AUDIT_EVENT_BUS",
  auditSource: "AUDIT_SOURCE",
  auditIssuer: "AUDIT_ISSUER",
};

export class BaseFunctionConfig {
  public readonly tableNames: TableNames;
  public readonly audit: AuditConfig;

  public static checkEnvEntry(name: string) {
    if (!process.env[name]) {
      throw new Error(`Missing required environment variable at init: ${name}`);
    }
  }

  constructor() {
    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);

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
    };
  }
}
