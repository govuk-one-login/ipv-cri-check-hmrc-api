import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";

const envVarNames = {
  vcIssuer: "ISSUER",
};

export class AbandonHandlerConfig extends BaseFunctionConfig {
  readonly issuer;

  constructor() {
    super();

    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);

    this.issuer = process.env[envVarNames.vcIssuer];
  }
}
