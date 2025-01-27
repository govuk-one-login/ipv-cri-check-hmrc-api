import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { TimeEvent } from "./time-event";
import { milliseconds, toEpochSecondsFromNow } from "./utils/date-time";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";
import { initOpenTelemetry } from "open-telemetry/src/otel-setup";

initOpenTelemetry();

export class TimeHandler implements LambdaInterface {
  public async handler(event: TimeEvent, context: Context) {
    const logHelper = new LogHelper(context);
    logHelper.logEntry(context.functionName, event.govJourneyId);

    try {
      return {
        seconds: toEpochSecondsFromNow(),
        milliseconds: milliseconds(),
        expiry: toEpochSecondsFromNow(event.ttlValue, event?.ttlUnit),
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
