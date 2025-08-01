export type HmrcErrsCiRecord = Record<"mappedHmrcErrors" | "ciValue", string>;
export type ContraIndicator = {
  ci: string;
  reason: string;
};

export const getHmrcErrsCiRecord = (pair: string): HmrcErrsCiRecord => {
  const [key, value] = pair.split(":");
  return {
    mappedHmrcErrors: key,
    ciValue: value,
  };
};
export const allMappedHmrcErrors = (mappings: string[]) =>
  mappings.map((mapping) => getHmrcErrsCiRecord(mapping).mappedHmrcErrors).join(",");

export const isCiHmrcErrorsMappingValid = (mappings: string[]) =>
  mappings.every((mapping) => {
    const record = getHmrcErrsCiRecord(mapping);
    return record.mappedHmrcErrors !== "" && record.ciValue !== undefined && record.ciValue.trim() !== "";
  });

export const convertInputToArray = (CommaSepInput: string) =>
  CommaSepInput.split(",").map((CommaSepInput) => CommaSepInput.trim());
