import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { TimeEvent } from "./time-event";
import { toEpochSecondsFromNow } from "./utils/date-time";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";

const logHelper = new LogHelper();

export class TimeHandler implements LambdaInterface {
  public async handler(event: TimeEvent, context: Context) {
    logHelper.logEntry(context.functionName, event.govJourneyId);

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
      logHelper.logError(context.functionName, event.govJourneyId, message);
      throw error;
    }
  }
}

const handlerClass = new TimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
