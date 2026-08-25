import { validateInputs } from "./ci-mappings-validator";
import { CiMappings, ContraIndicator } from "./types";
import { logger } from "@govuk-one-login/cri-logger";

export const getHmrcContraIndicators = (ciMappings: CiMappings, hmrcErrors: string[]): Array<ContraIndicator> => {
  if (!hmrcErrors || hmrcErrors.length === 0) {
    logger.info(`Found no HMRC errors.`);
    return [];
  }

  try {
    return getCIsForHmrcErrors(ciMappings, hmrcErrors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ message: "An unexpected Error has occurred getting HMRC errors", error: message });
    throw error;
  }
};
function getCIsForHmrcErrors(ciMappings: CiMappings, hmrcErrors: string[]): Array<ContraIndicator> {
  const { contraIndicationMapping, contraIndicatorReasonsMapping, extractedHmrcErrors } = validateInputs(
    ciMappings,
    hmrcErrors
  );

  const errorsWithCIs = contraIndicationMapping.flatMap(({ mappedHmrcErrors, ciValue }) => {
    const normalizedMappedHmrcErrors = new Set(mappedHmrcErrors.map((value) => value.trim().toUpperCase()));

    return extractedHmrcErrors
      .filter((hmrcError) => normalizedMappedHmrcErrors.has(hmrcError.trim().toUpperCase()))
      .map((hmrcError) => ({
        ci: ciValue.trim(),
        error: hmrcError.trim(),
      }));
  });

  return errorsWithCIs.map((c) => contraIndicatorReasonsMapping.find((m) => m.ci === c.ci)) as ContraIndicator[];
}
