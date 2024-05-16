import { LambdaInterface } from "@aws-lambda-powertools/commons";
import {
  CiMappingEvent,
  HMRC_ERRORS_ABSENT,
  getContraIndicatorWithReason,
  validateInputs,
} from "./ci-mapping-event-validator";
import { Logger } from "@aws-lambda-powertools/logger";
import { getHmrcErrsCiRecord, ContraIndicator } from "./utils/ci-mapping-util";

const logger = new Logger();
export class CiMappingHandler implements LambdaInterface {
  public async handler(
    event: CiMappingEvent,
    _context: unknown
  ): Promise<Array<ContraIndicator>> {
    try {
      return getCIsForHmrcErrors(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === HMRC_ERRORS_ABSENT) {
        return [];
      }
      logger.error({
        message: `Error in CiMappingHandler: ${message}`,
        govJourneyId: event.govJourneyId
      });

      throw error;
    }
  }
}

const getCIsForHmrcErrors = (event: CiMappingEvent): Array<ContraIndicator> => {
  const { contraIndicationMapping, hmrcErrors, contraIndicatorReasonsMapping } =
    validateInputs(event);

  const contraIndicators = contraIndicationMapping?.flatMap((ci) => {
    const { mappedHmrcErrors, ciValue } = getHmrcErrsCiRecord(ci);

    return hmrcErrors
      .flatMap((hmrcError) => hmrcError)
      .filter((hmrcError) =>
        mappedHmrcErrors
          .split(",")
          .map((value) => value.trim())
          .includes(hmrcError)
      )
      .map((hmrcError) => ({ ci: ciValue.trim(), reason: hmrcError.trim() }));
  });

  return getContraIndicatorWithReason(
    contraIndicatorReasonsMapping,
    contraIndicators
  );
};

const handlerClass = new CiMappingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
