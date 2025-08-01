import { CiMappings } from "./types/ci-mappings";
import {
  allMappedHmrcErrors,
  isCiHmrcErrorsMappingValid,
  ContraIndicator,
  convertInputToArray,
  getHmrcErrsCiRecord,
} from "./ci-mapping-util";

const CONTRAINDICATION_MAPPINGS_ABSENT_ERROR = "ContraIndicationMapping cannot be undefined in CiMappingEvent";
const CONTRAINDICATOR_REASONS_MAPPINGS_ABSENT_ERROR =
  "ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent";

export const HMRC_ERRORS_ABSENT = "Hmrc errors absent in CiMappingEvent";

export interface CiReasonsMapping {
  ci: string;
  reason: string;
}

export const validateInputs = (mappings: CiMappings) => {
  const contraIndicationMapping = getContraIndicationMappingMapping(mappings.contraIndicationMapping);
  const hmrcErrors = getInputHmrcErrors(mappings.hmrcErrors);
  const contraIndicatorReasonsMapping = getCiReasonsMapping(mappings.contraIndicatorReasonsMapping);

  const hmrcErrorIsNotMapped = (hmrcError: string) =>
    !allMappedHmrcErrors(contraIndicationMapping).toUpperCase().includes(hmrcError.toUpperCase());

  const allHmrcErrorsUnMatched = hmrcErrors.every(hmrcErrorIsNotMapped);
  const someHmrcErrorsUnMatched = hmrcErrors.some(hmrcErrorIsNotMapped);

  if (!isCiHmrcErrorsMappingValid(contraIndicationMapping)) {
    throw new Error("ContraIndicationMapping format is invalid");
  } else if (allHmrcErrorsUnMatched) {
    throw new Error("No matching hmrcError for any ContraIndicationMapping");
  } else if (someHmrcErrorsUnMatched) {
    throw new Error("Not all items in hmrc_errors have matching ContraIndicationMapping");
  }
  throwUnMatchedCIsAreDetectedError(contraIndicatorReasonsMapping, contraIndicationMapping);
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
    reason: ciReasons?.find((r) => areCIsEqual(r.ci, c.ci))?.reason ?? "",
  }));
};

const areCIsEqual = (reasonCi?: string, contraCi?: string): boolean =>
  reasonCi?.trim().toUpperCase() === contraCi?.trim().toUpperCase();

const getContraIndicationMappingMapping = (contraIndicationMapping: string[]): string[] => {
  if (contraIndicationMapping?.length) {
    return contraIndicationMapping;
  }
  throw new Error(CONTRAINDICATION_MAPPINGS_ABSENT_ERROR);
};

const getCiReasonsMapping = (ciReasonsMapping: CiReasonsMapping[]): CiReasonsMapping[] => {
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

const throwUnMatchedCIsAreDetectedError = (ciReasons: CiReasonsMapping[], ciMappings: string[]): void => {
  const reasonsMap = new Set(ciReasons.map((r) => r?.ci?.trim()));
  const contraMap = new Set(ciMappings.map((c) => getHmrcErrsCiRecord(c)?.ciValue?.trim()));

  const unMatchedCIsFromReasons = [...reasonsMap].filter(
    (reason) => ![...contraMap].some((ci) => ci.toUpperCase() === reason.toUpperCase())
  );

  const unMatchedCIsFromContraIndications = [...contraMap].filter(
    (ci) => ![...reasonsMap].some((reason) => reason.toUpperCase() === ci.toUpperCase())
  );

  const unMatchedCIs = [...unMatchedCIsFromReasons, ...unMatchedCIsFromContraIndications];
  const configurationLocation = unMatchedCIsFromReasons?.length
    ? "ContraIndicatorReasonsMapping"
    : "ContraIndicationMappings";

  if (unMatchedCIs?.length)
    throw new Error(`Unmatched ${configurationLocation} ${unMatchedCIs} detected in configured mappings`);
};
