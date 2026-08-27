import { validateHmrcErrors } from "./ci-mappings-validator";
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
function getCIsForHmrcErrors({ ciMapping, reasonsMapping }: CiMappings, hmrcErrors: string[]): Array<ContraIndicator> {
  const extractedHmrcErrors = validateHmrcErrors(ciMapping, hmrcErrors);

  const errorsWithCIs = ciMapping.flatMap(({ mappedHmrcErrors, ciValue }) => {
    const uniqueHmrcErrors = new Set(mappedHmrcErrors);

    return extractedHmrcErrors
      .filter((hmrcError) => uniqueHmrcErrors.has(hmrcError))
      .map((hmrcError) => ({
        ci: ciValue,
        error: hmrcError,
      }));
  });

  return errorsWithCIs.map((c) =>
    reasonsMapping.find((m) => m.ci.toUpperCase() === c.ci.toUpperCase())
  ) as ContraIndicator[];
}
