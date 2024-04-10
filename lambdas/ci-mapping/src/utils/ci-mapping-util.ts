export type HmrcErrsCiRecord = Record<"mappedHmrcErrors" | "ciValue", string>;
export type ContraIndicator = {
  ci: string;
  reason: string;
};

export const deduplicateValues = (values: string[]): string[] =>
  Array.from(new Set(values));
export const deduplicateContraIndicators = (
  values: Array<ContraIndicator>
): Array<ContraIndicator> => {
  const uniqueIndicators = new Set<string>();

  const uniqueStrings = values.map(
    (indicator) => `${indicator.ci}@${indicator.reason}`
  );

  uniqueStrings.forEach(uniqueIndicators.add, uniqueIndicators);

  return Array.from(uniqueIndicators).map((str) => {
    const [ci, reason] = str.split("@");
    return { ci, reason };
  });
};

export const getHmrcErrsCiRecord = (pair: string): HmrcErrsCiRecord => {
  const [key, value] = pair.split(":");
  return {
    mappedHmrcErrors: key,
    ciValue: value,
  };
};
export const allMappedHmrcErrors = (mappings: string[]) =>
  mappings
    .map((mapping) => getHmrcErrsCiRecord(mapping).mappedHmrcErrors)
    .join(",");

export const isCiHmrcErrorsMappingValid = (mappings: string[]) =>
  mappings.every((mapping) => {
    const record = getHmrcErrsCiRecord(mapping);
    return (
      record.mappedHmrcErrors !== "" &&
      record.ciValue !== undefined &&
      record.ciValue.trim() !== ""
    );
  });

export const flattenCommaSepInput = (CommaSepInput: string) =>
  CommaSepInput.split(",").flatMap((comma_sep_string) =>
    comma_sep_string.split(",").map((value) => value.trim())
  );
