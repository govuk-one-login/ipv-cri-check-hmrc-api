import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";
import { TimeUnits } from "../../../common/src/util/date-time";

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
  maxJwtTtl: "MAX_JWT_TTL",
  jwtTtlUnit: "JWT_TTL_UNIT",
  vcSigningKeyId: "VC_SIGNING_KEY_ID",
  vcIssuer: "ISSUER",
};

export type CredentialIssuerEnv = {
  issuer: string;
  maxJwtTtl: number;
  jwtTtlUnit: TimeUnits;
  vcSigningKeyId: string;
};
export class IssueCredFunctionConfig extends BaseFunctionConfig {
  public readonly credentialIssuerEnv: CredentialIssuerEnv;

  constructor() {
    super();

    Object.values(envVarNames).forEach(BaseFunctionConfig.checkEnvEntry);

    this.credentialIssuerEnv = {
      issuer: process.env[envVarNames.vcIssuer] as string,
      maxJwtTtl: Number(process.env[envVarNames.maxJwtTtl]),
      jwtTtlUnit: process.env[envVarNames.jwtTtlUnit] as TimeUnits,
      vcSigningKeyId: process.env[envVarNames.vcSigningKeyId] as string,
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
