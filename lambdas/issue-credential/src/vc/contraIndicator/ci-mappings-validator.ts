import { CiMappings } from "./types";

export function validateCiMappings({ contraIndicationMapping, contraIndicatorReasonsMapping }: CiMappings) {
  if (!contraIndicationMapping?.length) {
    throw new Error("ContraIndicationMapping cannot be undefined in CiMappingEvent");
  } else if (!contraIndicatorReasonsMapping?.length) {
    throw new Error("ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent");
  }

  const ciMapping = contraIndicationMapping.map((mapping) => {
    const [commaSeparatedErrors, ciValue] = mapping.split(":");
    const mappedHmrcErrors = commaSeparatedErrors.split(",");
    return { mappedHmrcErrors, ciValue };
  });

  if (
    ciMapping.some(
      ({ mappedHmrcErrors, ciValue }) => mappedHmrcErrors.includes("") || ciValue === undefined || ciValue.trim() === ""
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

  if (unmatchedCIs.length > 0) {
    const unmatchedCILocations = [
      ...(mappingCIsNotInReasons.length > 0 ? ["ContraIndicationMappings"] : []),
      ...(reasonCIsNotInMapping.length > 0 ? ["ContraIndicatorReasonsMapping"] : []),
    ];
    throw new Error(
      `Unmatched ${unmatchedCILocations.join(" & ")} ${unmatchedCIs.join(",")} detected in configured mappings`
    );
  }

  return { ciMapping, reasonsMapping: contraIndicatorReasonsMapping };
}

export const validateInputs = (ciMappings: CiMappings, hmrcErrors: string[]) => {
  const { ciMapping, reasonsMapping } = validateCiMappings(ciMappings);

  const allHmrcErrorsInCiMapping = new Set(
    ciMapping.flatMap((m) => m.mappedHmrcErrors.map((e) => e.toUpperCase().trim()))
  );

  const extractedHmrcErrors = hmrcErrors.flatMap((error) => error.split(",").map((string) => string.trim()));

  const unmappedErrorCount = extractedHmrcErrors.filter(
    (error) => !allHmrcErrorsInCiMapping.has(error.toUpperCase())
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
