import {
  ContraIndicator,
  allMappedHmrcErrors,
  convertInputToArray,
  getHmrcErrsCiRecord,
  isCiHmrcErrorsMappingValid,
} from "./utils/ci-mapping-util";

const CONTRAINDICATION_MAPPINGS_ABSENT_ERROR =
  "ContraIndicationMapping cannot be undefined in CiMappingEvent";
const CONTRAINDICATOR_REASONS_MAPPINGS_ABSENT_ERROR =
  "ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent";

export const HMRC_ERRORS_ABSENT = "Hmrc errors absent in CiMappingEvent";
export interface CiMappingEvent {
  contraIndicationMapping: string[];
  hmrcErrors: string[];
  contraIndicatorReasonsMapping: Array<CiReasonsMapping>;
}

export interface CiReasonsMapping {
  ci: string;
  reason: string;
}

export const validateInputs = (event: CiMappingEvent) => {
  const contraIndicationMapping = getContraIndicationMappingMapping(
    event.contraIndicationMapping
  );
  const hmrcErrors = getInputHmrcErrors(event.hmrcErrors);
  const contraIndicatorReasonsMapping = getCiReasonsMapping(
    event.contraIndicatorReasonsMapping
  );

  const hmrcErrorIsNotMapped = (hmrcError: string) =>
    !allMappedHmrcErrors(contraIndicationMapping).includes(hmrcError);

  const allHmrcErrorsUnMatched = hmrcErrors.every(hmrcErrorIsNotMapped);
  const someHmrcErrorsUnMatched = hmrcErrors.some(hmrcErrorIsNotMapped);

  if (!isCiHmrcErrorsMappingValid(contraIndicationMapping)) {
    throw new Error("ContraIndicationMapping format is invalid");
  } else if (allHmrcErrorsUnMatched) {
    throw new Error("No matching hmrcError for any ContraIndicationMapping");
  } else if (someHmrcErrorsUnMatched) {
    throw new Error(
      "Not all items in hmrc_errors have matching ContraIndicationMapping"
    );
  }
  throwUnMatchedCIsAreDetectedError(
    contraIndicatorReasonsMapping,
    contraIndicationMapping
  );
  return {
    contraIndicationMapping,
    hmrcErrors,
    contraIndicatorReasonsMapping,
  };
};

export const getContraIndicatorWithReason = (
  ciReasons: CiReasonsMapping[],
  contraIndicators: ContraIndicator[]
): ContraIndicator[] => {
  return contraIndicators.map((c) => ({
    ci: c.ci,
    reason: ciReasons?.find((r) => areCIsEqual(r.ci, c.ci))?.reason,
  }));
};

const areCIsEqual = (reasonCi?: string, contraCi?: string): boolean =>
  reasonCi?.trim() === contraCi?.trim();

const getContraIndicationMappingMapping = (
  contraIndicationMapping: string[]
): string[] => {
  if (contraIndicationMapping?.length) {
    return contraIndicationMapping;
  }
  throw new Error(CONTRAINDICATION_MAPPINGS_ABSENT_ERROR);
};

const getCiReasonsMapping = (
  ciReasonsMapping: CiReasonsMapping[]
): CiReasonsMapping[] => {
  if (ciReasonsMapping?.length) {
    return ciReasonsMapping;
  }
  throw new Error(CONTRAINDICATOR_REASONS_MAPPINGS_ABSENT_ERROR);
};

const getInputHmrcErrors = (hmrcErrors: string[] = []) => {
  if (!hmrcErrors.length) {
    throw new Error(HMRC_ERRORS_ABSENT);
  }
  return hmrcErrors.reduce((result, hmrcError) => {
    return result.concat(convertInputToArray(hmrcError));
  }, [] as string[]);
};

const throwUnMatchedCIsAreDetectedError = (
  ciReasons: CiReasonsMapping[],
  ciMappings: string[]
): void => {
  const reasonsMap = new Set(ciReasons.map((r) => r?.ci?.trim()));
  const contraMap = new Set(
    ciMappings.map((c) => getHmrcErrsCiRecord(c)?.ciValue?.trim())
  );

  const unMatchedCIsFromReasons = [...reasonsMap].filter(
    (ci) => !contraMap.has(ci)
  );
  const unMatchedCIsFromContraIndications = [...contraMap].filter(
    (ci) => !reasonsMap.has(ci)
  );
  const unMatchedCIs = [
    ...unMatchedCIsFromReasons,
    ...unMatchedCIsFromContraIndications,
  ];
  const configurationLocation = unMatchedCIsFromReasons?.length
    ? "ContraIndicatorReasonsMapping"
    : "ContraIndicationMappings";

  if (unMatchedCIs?.length)
    throw new Error(
      `Unmatched ${configurationLocation} ${unMatchedCIs} detected in configured mappings`
    );
};
