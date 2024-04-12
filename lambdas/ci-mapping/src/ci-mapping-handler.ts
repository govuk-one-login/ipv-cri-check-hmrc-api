import { LambdaInterface } from "@aws-lambda-powertools/commons";
import {
  CiMappingEvent,
  CiReasonsMapping,
  HMRC_ERRORS_ABSENT,
  areCIsEqual,
  validateInputs,
} from "./ci-mapping-event-validator";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  getHmrcErrsCiRecord,
  ContraIndicator,
  deduplicateContraIndicators,
} from "./utils/ci-mapping-util";

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
      logger.error(`Error in CiMappingHandler: ${message}`);

      throw error;
    }
  }
}

const getCIsForHmrcErrors = (event: CiMappingEvent): Array<ContraIndicator> => {
  const { ci_mappings, hmrc_errors, ci_reasons_mapping } =
    validateInputs(event);

  const contraIndicators = ci_mappings?.flatMap((ci) => {
    const { mappedHmrcErrors, ciValue } = getHmrcErrsCiRecord(ci);

    return hmrc_errors
      .flatMap((hmrcError) => hmrcError)
      .filter((hmrcError) =>
        mappedHmrcErrors
          .split(",")
          .map((value) => value.trim())
          .includes(hmrcError)
      )
      .map((hmrcError) => ({ ci: ciValue.trim(), reason: hmrcError.trim() }));
  });

  return deduplicateContraIndicators(
    getContraIndicatorWithReason(ci_reasons_mapping, contraIndicators)
  );
};

const getContraIndicatorWithReason = (
  ciReasons?: CiReasonsMapping[],
  contraIndicators?: ContraIndicator[]
): ContraIndicator[] | undefined => {
  return contraIndicators?.map((contra) => ({
    ci: contra.ci,
    reason: ciReasons?.find((reason) => areCIsEqual(reason.ci, contra.ci))
      ?.reason,
  }));
};

const handlerClass = new CiMappingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
