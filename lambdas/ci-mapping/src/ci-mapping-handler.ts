import { LambdaInterface } from "@aws-lambda-powertools/commons";
import {
  CiMappingEvent,
  HMRC_ERRORS_ABSENT,
  validateInputs,
} from "./ci-mapping-event-validator";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  getHmrcErrsCiRecord,
  deduplicateValues,
} from "./utils/ci-mapping-util";

const logger = new Logger();
export class CiMappingHandler implements LambdaInterface {
  public async handler(
    event: CiMappingEvent,
    _context: unknown
  ): Promise<Array<string>> {
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

const getCIsForHmrcErrors = (event: CiMappingEvent): Array<string> => {
  const { ci_mappings, hmrc_errors } = validateInputs(event);

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
      .map(() => ciValue.trim());
  });

  return deduplicateValues(contraIndicators);
};

const handlerClass = new CiMappingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
