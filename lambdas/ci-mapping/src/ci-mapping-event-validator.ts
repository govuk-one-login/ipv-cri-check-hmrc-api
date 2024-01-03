import {
  allMappedHmrcErrors,
  flattenCommaSepInput,
  isCiHmrcErrorsMappingValid,
} from "./utils/ci-mapping-util";

export const HMRC_ERRORS_ABSENT = "Hmrc errors absent in CiMappingEvent";
export interface CiMappingEvent {
  ci_mapping: string[];
  hmrc_errors: string[];
}

export const validateInputs = (event: CiMappingEvent) => {
  const ci_mappings = getCiMapping(event?.ci_mapping);
  const hmrc_errors = getInputHmrcErrors(event.hmrc_errors);

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

  return { ci_mappings, hmrc_errors };
};

const getCiMapping = (ci_mapping?: string[]) => {
  if (ci_mapping && ci_mapping.length > 0) {
    return ci_mapping;
  }
  throw new Error("ci_mapping cannot be undefined in CiMappingEvent");
};

const getInputHmrcErrors = (hmrc_errors: string[] = []) => {
  if (hmrc_errors.length === 0) {
    throw new Error(HMRC_ERRORS_ABSENT);
  }
  return hmrc_errors.reduce((result, hmrc_error) => {
    return result.concat(flattenCommaSepInput(hmrc_error));
  }, [] as string[]);
};
