import { AuditConfig } from "../types/audit";

const envVarNames = {
  sessionTable: "SESSION_TABLE",
  auditQueueUrl: "AUDIT_QUEUE_URL",
  auditComponentId: "AUDIT_COMPONENT_ID",
};

export class BaseFunctionConfig {
  public readonly audit: AuditConfig;

  public static checkEnvEntry(name: string) {
    if (!process.env[name]) {
      throw new Error(
        `Missing required environment variable at init: ${name}. Env: ${JSON.stringify(process.env, undefined, 2)}`
      );
    }
  }

  constructor() {
    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);

    this.audit = {
      queueUrl: process.env[envVarNames.auditQueueUrl] as string,
      componentId: process.env[envVarNames.auditComponentId] as string,
    };
  }

  public get tableNames(): { sessionTable: string } {
    return { sessionTable: process.env[envVarNames.sessionTable] as string };
  }
}
