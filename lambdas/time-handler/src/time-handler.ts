import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { TimeEvent } from "./time-event";
import { milliseconds, toEpochSecondsFromNow } from "./utils/date-time";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";

export class TimeHandler implements LambdaInterface {
  constructor(private readonly logger: LogHelper = new LogHelper()) {}
  public async handler(event: TimeEvent, context: Context) {
    this.logger.logEntry(context.functionName, event.govJourneyId);

    try {
      return {
        seconds: toEpochSecondsFromNow(),
        milliseconds: milliseconds(),
        expiry: toEpochSecondsFromNow(event.ttlValue, event?.ttlUnit),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.logError(context.functionName, event.govJourneyId, message);
      throw error;
    }
  }
}

const handlerClass = new TimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
