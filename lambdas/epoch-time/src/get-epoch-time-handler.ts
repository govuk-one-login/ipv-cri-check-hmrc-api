import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";

export type TimeUnit = "seconds" | "milliseconds";

interface EpochTimeEvent {
  dateTime: string;
  govJourneyId: string;
  unit?: TimeUnit;
}

const logHelper = new LogHelper();

export class EpochTimeHandler implements LambdaInterface {
  public async handler(
    event: EpochTimeEvent,
    context: Context
  ): Promise<number> {
    logHelper.logEntry(context.functionName, event.govJourneyId);
    if (!event.dateTime) {
      throw new Error("Invalid event object: missing dateTime");
    }
    const unit = event.unit ?? "seconds";
    const timestamp = new Date(event.dateTime).getTime();

    if (isNaN(timestamp)) {
      const errorMessage = "Invalid date format";
      logHelper.logError(
        context.functionName,
        event.govJourneyId,
        errorMessage
      );
      throw new Error(errorMessage);
    }
    if (!["seconds", "milliseconds"].includes(unit)) {
      const errorMessage = `Invalid unit value: ${unit}`;
      logHelper.logError(
        context.functionName,
        event.govJourneyId,
        errorMessage
      );
      throw new Error(errorMessage);
    }

    return unit === "milliseconds" ? timestamp : Math.floor(timestamp / 1000);
  }
}

const handlerClass = new EpochTimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
