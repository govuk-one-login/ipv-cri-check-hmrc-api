import { CiReasonsMapping } from "./ci-reasons-mapping";

export interface CiMappings {
  contraIndicationMapping: string[];
  hmrcErrors: string[];
  contraIndicatorReasonsMapping: Array<CiReasonsMapping>;
}
