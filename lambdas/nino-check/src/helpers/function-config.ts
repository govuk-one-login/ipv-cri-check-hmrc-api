import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";

export type HmrcEnvVars = {
  pdvUserAgentParamName: string;
};

const envVarNames = {
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
}
