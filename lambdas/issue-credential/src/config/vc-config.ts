import { CriError } from "../../../common/src/errors/cri-error";
import { getParametersValues } from "../../../common/src/util/get-parameters";
import { logger } from "../../../common/src/util/logger";
import { CiReasonsMapping } from "../vc/contraIndicator/types/ci-reasons-mapping";

const cacheTtlInSeconds = Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;
export type VcCheckConfig = {
  readonly kms: { signingKeyId: string };
  readonly contraIndicator: { errorMapping: string[]; reasonsMapping: CiReasonsMapping[] };
};
export const getVcConfig = async (vcSigningKeyId: string): Promise<VcCheckConfig> => {
  const errorMapping = "/check-hmrc-cri-api/contraindicationMappings";
  const reasonsMapping = "/check-hmrc-cri-api/contraIndicatorReasonsMapping";
  try {
    const ssmParams = await getParametersValues([errorMapping, reasonsMapping], cacheTtlInSeconds);
    logger.info("Retrieved Check Hmrc VC parameters.");
    return {
      kms: { signingKeyId: vcSigningKeyId },
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
