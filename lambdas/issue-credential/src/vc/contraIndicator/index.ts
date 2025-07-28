import { HMRC_ERRORS_ABSENT, getContraIndicatorWithReason, validateInputs } from "./ci-mappings-validator";
import { getHmrcErrsCiRecord, ContraIndicator } from "./ci-mapping-util";
import { CiMappings } from "./types/ci-mappings";
import { logger } from "../../../../common/src/util/logger";

export const getHmrcContraIndicators = (ciMappings: CiMappings): Array<ContraIndicator> => {
  try {
    return getCIsForHmrcErrors(ciMappings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === HMRC_ERRORS_ABSENT) {
      logger.info(`Found no HMRC errors.`);
      return [];
    }
    logger.error({ message: "An unexpected Error has occurred getting HMRC errors", error: message });
    throw error;
  }
};
const getCIsForHmrcErrors = (ciMappings: CiMappings): Array<ContraIndicator> => {
  const { contraIndicationMapping, hmrcErrors, contraIndicatorReasonsMapping } = validateInputs(ciMappings);

  const contraIndicators = contraIndicationMapping?.flatMap((ci) => {
    const { mappedHmrcErrors, ciValue } = getHmrcErrsCiRecord(ci);

    const normalizedMappedHmrcErrors = mappedHmrcErrors.split(",").map((value) => value.trim().toUpperCase());

    return hmrcErrors
      .flatMap((hmrcError) => hmrcError)
      .filter((hmrcError) => normalizedMappedHmrcErrors.includes(hmrcError.trim().toUpperCase()))
      .map((hmrcError) => ({
        ci: ciValue.trim(),
        reason: hmrcError.trim(),
      }));
  });

  return getContraIndicatorWithReason(contraIndicatorReasonsMapping, contraIndicators);
};
