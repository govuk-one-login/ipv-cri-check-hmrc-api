import { CiReasonsMapping } from "./ci-reasons-mapping";

export interface CiMappingEvent {
  contraIndicationMapping: string[];
  hmrcErrors: string[];
  contraIndicatorReasonsMapping: Array<CiReasonsMapping>;
  govJourneyId: string;
}
