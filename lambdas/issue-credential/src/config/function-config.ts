import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";
import { TimeUnits } from "../../../common/src/util/date-time";

export type CredentialIssuerEnv = {
  maxJwtTtl: number;
  jwtTtlUnit: string;
  commonStackName: string;
};

const envVarNames = {
  maxJwtTtl: "MAX_JWT_TTL",
  jwtTtlUnit: "JWT_TTL_UNIT",
  commonStackName: "COMMON_STACK_NAME",
};

export class IssueCredFunctionConfig extends BaseFunctionConfig {
  public readonly credentialIssuerEnv: CredentialIssuerEnv;

  constructor() {
    super();

    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);

    this.credentialIssuerEnv = {
      maxJwtTtl: Number(process.env[envVarNames.maxJwtTtl]),
      jwtTtlUnit: process.env[envVarNames.jwtTtlUnit] as TimeUnits,
      commonStackName: process.env[envVarNames.commonStackName] as string,
    };
  }
}
