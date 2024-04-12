import {
  allMappedHmrcErrors,
  flattenCommaSepInput,
  isCiHmrcErrorsMappingValid,
} from "./utils/ci-mapping-util";

export const HMRC_ERRORS_ABSENT = "Hmrc errors absent in CiMappingEvent";
const CI_MAPPINGS_ABSENT_ERROR = "ContraIndicator Mappings are absent";
export interface CiMappingEvent {
  ci_mapping: string[];
  hmrc_errors: string[];
  ci_reason_mapping: Array<CiReasonsMapping>;
}

export interface CiReasonsMapping {
  ci: string;
  reason: string;
}

export const validateInputs = (event: CiMappingEvent) => {
  const ci_mappings = getCiMapping(event?.ci_mapping);
  const hmrc_errors = getInputHmrcErrors(event.hmrc_errors);
  const ci_reasons_mapping = getCiReasonsMapping(event.ci_reason_mapping);

  const hmrcErrorIsNotMapped = (hmrcError: string) =>
    !allMappedHmrcErrors(ci_mappings).includes(hmrcError);

  const allHmrcErrorsUnMatched = hmrc_errors.every(hmrcErrorIsNotMapped);
  const someHmrcErrorsUnMatched = hmrc_errors.some(hmrcErrorIsNotMapped);

  if (!isCiHmrcErrorsMappingValid(ci_mappings)) {
    throw new Error("ci_mapping format is invalid");
  } else if (allHmrcErrorsUnMatched) {
    throw new Error("No matching hmrc_error for any ci_mapping");
  } else if (someHmrcErrorsUnMatched) {
    throw new Error("Not all items in hmrc_errors have matching ci_mapping");
  }

  return { ci_mappings, hmrc_errors, ci_reasons_mapping };
};

export const areCIsEqual = (reason?: string, contra?: string): boolean =>
  reason?.trim() === contra?.trim();

export const getCiMapping = (ci_mapping?: string[]) => {
  if (ci_mapping && ci_mapping.length > 0) {
    return ci_mapping;
  }
  throw new Error("ci_mapping cannot be undefined in CiMappingEvent");
};

const getCiReasonsMapping = (
  ciReasonsMapping: CiReasonsMapping[]
): CiReasonsMapping[] => {
  if (ciReasonsMapping?.length === 0) {
    throw new Error(CI_MAPPINGS_ABSENT_ERROR);
  }
  return ciReasonsMapping;
};

const getInputHmrcErrors = (hmrc_errors: string[] = []) => {
  if (hmrc_errors.length === 0) {
    throw new Error(HMRC_ERRORS_ABSENT);
  }
  return hmrc_errors.reduce((result, hmrc_error) => {
    return result.concat(flattenCommaSepInput(hmrc_error));
  }, [] as string[]);
};
