import { CiMappings } from "./types/ci-mappings";
import { ContraIndicator } from "./ci-mapping-util";

const CONTRAINDICATION_MAPPINGS_ABSENT_ERROR = "ContraIndicationMapping cannot be undefined in CiMappingEvent";
const CONTRAINDICATOR_REASONS_MAPPINGS_ABSENT_ERROR =
  "ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent";

export interface CiReasonsMapping {
  ci: string;
  reason: string;
}

export function validateCiMappings({ contraIndicationMapping, contraIndicatorReasonsMapping }: CiMappings) {
  if (!contraIndicationMapping?.length) {
    throw new Error(CONTRAINDICATION_MAPPINGS_ABSENT_ERROR);
  } else if (!contraIndicatorReasonsMapping?.length) {
    throw new Error(CONTRAINDICATOR_REASONS_MAPPINGS_ABSENT_ERROR);
  }

  const ciMapping = contraIndicationMapping.map((mapping) => {
    const [commaSeparatedErrors, ciValue] = mapping.split(":");
    const mappedHmrcErrors = commaSeparatedErrors.split(",");
    return { mappedHmrcErrors, ciValue };
  });

  if (
    ciMapping.some(
      ({ mappedHmrcErrors, ciValue }) =>
        mappedHmrcErrors.some((msg) => msg === "") || ciValue === undefined || ciValue.trim() === ""
    )
  ) {
    throw new Error("ContraIndicationMapping format is invalid");
  }

  const mappingCIs = ciMapping.map((m) => m.ciValue.trim());
  const uniqueMappingCIs = [...new Set(mappingCIs)];

  const reasonsCIs = contraIndicatorReasonsMapping.map((r) => r.ci.trim());
  const uniqueReasonsCIs = [...new Set(reasonsCIs)];

  const mappingCIsNotInReasons = uniqueMappingCIs.filter((ci) => !uniqueReasonsCIs.includes(ci));
  const reasonCIsNotInMapping = uniqueReasonsCIs.filter((ci) => !uniqueMappingCIs.includes(ci));

  const unmatchedCIs = [...mappingCIsNotInReasons, ...reasonCIsNotInMapping];

  if (unmatchedCIs?.length) {
    const unmatchedCILocations = [
      ...(mappingCIsNotInReasons.length ? ["ContraIndicatorReasonsMapping"] : []),
      ...(reasonCIsNotInMapping.length ? ["ContraIndicationMappings"] : []),
    ];

    throw new Error(
      `Unmatched ${unmatchedCILocations.join(" & ")} ${unmatchedCIs.join(", ")} detected in configured mappings`
    );
  }

  return { ciMapping, reasonsMapping: contraIndicatorReasonsMapping };
}

export const validateInputs = (ciMappings: CiMappings, hmrcErrors: string[]) => {
  const { ciMapping, reasonsMapping } = validateCiMappings(ciMappings);

  const allHmrcErrorsInCiMapping = ciMapping.flatMap((m) => m.mappedHmrcErrors.map((e) => e.toUpperCase()));

  const extractedHmrcErrors = hmrcErrors.flatMap((error) => error.split(",").map((string) => string.trim()));

  const unmappedErrorCount = extractedHmrcErrors.filter(
    (error) => !allHmrcErrorsInCiMapping.includes(error.toUpperCase())
  ).length;

  if (unmappedErrorCount > 0) {
    if (unmappedErrorCount === extractedHmrcErrors.length) {
      throw new Error("No matching hmrcError for any ContraIndicationMapping");
    } else {
      throw new Error("Not all items in hmrc_errors have matching ContraIndicationMapping");
    }
  }

  return {
    contraIndicationMapping: ciMapping,
    extractedHmrcErrors,
    contraIndicatorReasonsMapping: reasonsMapping,
  };
};

export const getContraIndicatorWithReason = (
  ciReasons: CiReasonsMapping[],
  contraIndicators: ContraIndicator[]
): ContraIndicator[] => {
  return contraIndicators.map((c) => ({
    ci: c.ci,
    reason: ciReasons?.find((r) => areCIsEqual(r.ci, c.ci))?.reason ?? "",
  }));
};

const areCIsEqual = (reasonCi?: string, contraCi?: string): boolean =>
  reasonCi?.trim().toUpperCase() === contraCi?.trim().toUpperCase();
