import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";
import { TimeUnits } from "../../../common/src/util/date-time";

export type CredentialIssuerEnv = {
  maxJwtTtl: number;
  jwtTtlUnit: string;
};

const envVarNames = {
  maxJwtTtl: "MAX_JWT_TTL",
  jwtTtlUnit: "JWT_TTL_UNIT",
};

export class IssueCredFunctionConfig extends BaseFunctionConfig {
  public readonly credEnv: CredentialIssuerEnv;

  constructor() {
    super();

    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);

    this.credEnv = {
      maxJwtTtl: Number(process.env[envVarNames.maxJwtTtl]),
      jwtTtlUnit: process.env[envVarNames.jwtTtlUnit] as TimeUnits,
    };
  }
}
