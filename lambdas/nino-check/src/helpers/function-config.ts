import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";

export type TableNames = {
  sessionTable: string;
  personIdentityTable: string;
  attemptTable: string;
  ninoUserTable: string;
};

const envVarNames = {
  personIdentityTable: "PERSON_IDENTITY_TABLE",
  attemptTable: "ATTEMPT_TABLE",
  ninoUserTable: "NINO_USER_TABLE",
};

export class NinoCheckFunctionConfig extends BaseFunctionConfig {

  constructor() {
    super();
    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);
  }

  public get tableNames(): TableNames {
    return {
      sessionTable: super.tableNames.sessionTable,
      personIdentityTable: process.env[envVarNames.personIdentityTable] as string,
      attemptTable: process.env[envVarNames.attemptTable] as string,
      ninoUserTable: process.env[envVarNames.ninoUserTable] as string,
    };
  }
}
