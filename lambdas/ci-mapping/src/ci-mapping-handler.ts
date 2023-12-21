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
  return Array.from(
    new Set(
      event.ci_mapping.flatMap((ci) => {
        const [ciKey, ciValue] = ci.split(":");
        return event.hmrc_errors
          .flatMap((error) => error.split(",").map((e) => e.trim()))
          .filter((hmrcError) => ciKey.includes(hmrcError))
          .map(() => ciValue);
      })
    )
  );
}

const handlerClass = new CiMappingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
