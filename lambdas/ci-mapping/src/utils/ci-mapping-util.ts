export type HmrcErrsCiRecord = Record<"mappedHmrcErrors" | "ciValue", string>;

export const deduplicateValues = (values: string[]): string[] =>
  Array.from(new Set(values));

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
