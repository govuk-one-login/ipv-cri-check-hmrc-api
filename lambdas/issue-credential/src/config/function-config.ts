import { BaseFunctionConfig } from "../../../common/src/config/base-function-config";
import { CriError } from "../../../common/src/errors/cri-error";
import { TimeUnits } from "../../../common/src/util/date-time";
import { getParametersValues } from "../../../common/src/util/get-parameters";
import { logger } from "../../../common/src/util/logger";

const envVarNames = {
  maxJwtTtl: "MAX_JWT_TTL",
  jwtTtlUnit: "JWT_TTL_UNIT",
  commonStackName: "COMMON_STACK_NAME",
};
export type CredentialIssuerEnv = {
  maxJwtTtl: number;
  jwtTtlUnit: string;
  commonStackName: string;
};
export type VcCheckConfig = {
  readonly kms: { signingKeyId: string };
  readonly contraIndicator: { errorMapping: string[]; reasonsMapping: object[] };
};
const cacheTtlInSeconds = Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;

export const getVcConfig = async (commonStackName: string) => {
  const vcSigningKeyId = `/${commonStackName}/verifiableCredentialKmsSigningKeyId`;
  const errorMapping = "/check-hmrc-cri-api/contraindicationMappings";
  const reasonsMapping = "/check-hmrc-cri-api/contraIndicatorReasonsMapping";
  try {
    const ssmParams = await getParametersValues([vcSigningKeyId, errorMapping, reasonsMapping], cacheTtlInSeconds);
    logger.info("Retrieved Check Hmrc VC parameters.");
    return {
      kms: { signingKeyId: ssmParams[vcSigningKeyId] },
      contraIndicator: {
        errorMapping: ssmParams[errorMapping].split("||"),
        reasonsMapping: JSON.parse(ssmParams[reasonsMapping]),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CriError(500, `Failed to load VC config: ${message}`);
  }
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
