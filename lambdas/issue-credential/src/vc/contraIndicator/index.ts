import { getContraIndicatorWithReason, validateInputs } from "./ci-mappings-validator";
import { ContraIndicator } from "./ci-mapping-util";
import { CiMappings } from "./types/ci-mappings";
import { logger } from "@govuk-one-login/cri-logger";

export const getHmrcContraIndicators = (ciMappings: CiMappings, hmrcErrors: string[]): Array<ContraIndicator> => {
  if (hmrcErrors.length === 0) {
    logger.info(`Found no HMRC errors.`);
    return [];
  }

  try {
    return getCIsForHmrcErrors(ciMappings, hmrcErrors);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ message: "An unexpected Error has occurred getting HMRC errors", error: message });
    throw error;
  }
};
const getCIsForHmrcErrors = (ciMappings: CiMappings, hmrcErrors: string[]): Array<ContraIndicator> => {
  const { contraIndicationMapping, contraIndicatorReasonsMapping, extractedHmrcErrors } = validateInputs(
    ciMappings,
    hmrcErrors
  );

  const contraIndicators = contraIndicationMapping?.flatMap(({ mappedHmrcErrors, ciValue }) => {
    const normalizedMappedHmrcErrors = new Set(mappedHmrcErrors.map((value) => value.trim().toUpperCase()));

    return extractedHmrcErrors
      .filter((hmrcError) => normalizedMappedHmrcErrors.has(hmrcError.trim().toUpperCase()))
      .map((hmrcError) => ({
        ci: ciValue.trim(),
        reason: hmrcError.trim(),
      }));
  });

  return getContraIndicatorWithReason(contraIndicatorReasonsMapping, contraIndicators);
};
