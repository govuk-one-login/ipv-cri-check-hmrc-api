import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { TimeEvent } from "./time-event";
import { toEpochSecondsFromNow } from "./utils/date-time";

const logger = new Logger();

export class TimeHandler implements LambdaInterface {
  public async handler(event: TimeEvent, _context: unknown) {
    if (event.ttlValue < 0) {
      throw new Error(`ttlValue must be positive (provided ${event.ttlValue})`);
    }

    try {
      const notBeforeDate = toEpochSecondsFromNow();

      return {
        nbf: notBeforeDate,
        expiry: toEpochSecondsFromNow(event.ttlValue, event.ttlUnit),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error in TimeHandler: ${message}`);
      throw error;
    }
  }
}

const handlerClass = new TimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
