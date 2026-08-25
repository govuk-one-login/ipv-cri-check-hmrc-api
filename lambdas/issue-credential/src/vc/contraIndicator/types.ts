export type ContraIndicator = {
  ci: string;
  reason: string;
};

export interface CiMappings {
  contraIndicationMapping: string[];
  contraIndicatorReasonsMapping: ContraIndicator[];
}
