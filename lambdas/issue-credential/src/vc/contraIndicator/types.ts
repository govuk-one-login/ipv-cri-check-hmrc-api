export type ContraIndicator = {
  ci: string;
  reason: string;
};

export interface CiMappingEntry {
  ciValue: string;
  mappedHmrcErrors: string[];
}

export interface CiMappings {
  ciMapping: CiMappingEntry[];
  reasonsMapping: ContraIndicator[];
}
