import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";

export type HmrcEnvVars = {
  pdvUserAgentParamName: string;
};

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
  pdvUserAgentParamName: "PDV_USER_AGENT_PARAM_NAME",
};

export class NinoCheckFunctionConfig extends BaseFunctionConfig {
  public readonly hmrcApi: HmrcEnvVars;

  constructor() {
    super();

    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);

    this.hmrcApi = {
      pdvUserAgentParamName: process.env[envVarNames.pdvUserAgentParamName] as string,
    };
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
