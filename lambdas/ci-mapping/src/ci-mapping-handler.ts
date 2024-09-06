import { LambdaInterface } from "@aws-lambda-powertools/commons";
import {
  HMRC_ERRORS_ABSENT,
  getContraIndicatorWithReason,
  validateInputs,
} from "./ci-mapping-event-validator";

import { Context } from "aws-lambda";
import { getHmrcErrsCiRecord, ContraIndicator } from "./utils/ci-mapping-util";
import { CiMappingEvent } from "./ci-mapping-event";
import { LogHelper } from "../../logging/log-helper";

const logHelper = new LogHelper();

export class CiMappingHandler implements LambdaInterface {
  public async handler(
    event: CiMappingEvent,
    context: Context
  ): Promise<Array<ContraIndicator>> {
    logHelper.logEntry(context.functionName, event.govJourneyId);
    try {
      return getCIsForHmrcErrors(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === HMRC_ERRORS_ABSENT) {
        return [];
      }
      logHelper.logError(context.functionName, event.govJourneyId, message);
      throw error;
    }
  }
}

const getCIsForHmrcErrors = (event: CiMappingEvent): Array<ContraIndicator> => {
  const { contraIndicationMapping, hmrcErrors, contraIndicatorReasonsMapping } =
    validateInputs(event);

  const contraIndicators = contraIndicationMapping?.flatMap((ci) => {
    const { mappedHmrcErrors, ciValue } = getHmrcErrsCiRecord(ci);

    const normalizedMappedHmrcErrors = mappedHmrcErrors
      .split(",")
      .map((value) => value.trim().toUpperCase());

    return hmrcErrors
      .flatMap((hmrcError) => hmrcError)
      .filter((hmrcError) =>
        normalizedMappedHmrcErrors.includes(hmrcError.trim().toUpperCase())
      )
      .map((hmrcError) => ({
        ci: ciValue.trim(),
        reason: hmrcError.trim(),
      }));
  });

  return getContraIndicatorWithReason(
    contraIndicatorReasonsMapping,
    contraIndicators
  );
};

const handlerClass = new CiMappingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
