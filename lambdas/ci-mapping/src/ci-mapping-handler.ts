import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { CiMappingEvent } from "./ci-mapping-event";
import { Logger } from "@aws-lambda-powertools/logger";

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
      logger.error(`Error in CiMappingHandler: ${message}`);
      throw error;
    }
  }
}

function getCIsForHmrcErrors(event: CiMappingEvent): Array<string> {
  if (event.hmrc_errors.length === 0) {
    return [];
  }
  let totalHmrcErrors = 0;
  const result: Array<string> = [];
  event.hmrc_errors.forEach((hmrcError) => {
    const hmrcErrorParts = hmrcError
      .split(",")
      .map((hmrcError) => hmrcError.trim());
    totalHmrcErrors += hmrcErrorParts.length;
    event.ci_mapping.forEach((ci) => {
      const [ciKey, ciValue] = ci.split(":");
      const ciKeyValues = ciKey.split(",").map((value) => value.trim());
      hmrcErrorParts.forEach((hmrcError) => {
        if (ciKeyValues.includes(hmrcError)) {
          result.push(ciValue);
        }
      });
    });
  });
  if (result.length === 0) {
    throw new Error("No matching hmrc_error for any ci_mapping");
  }
  if (result.length != totalHmrcErrors) {
    throw new Error("Not all items in hmrc_errors have matching ci_mapping");
  }
  return Array.from(new Set(result));
}

const handlerClass = new CiMappingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
