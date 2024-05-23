import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";

export type TimeUnit = "seconds" | "milliseconds";

interface EpochTimeEvent {
  dateTime: string;
  govJourneyId: string;
  unit?: TimeUnit;
}

const logger = new Logger();

export class EpochTimeHandler implements LambdaInterface {
  public async handler(
    event: EpochTimeEvent,
    _context: unknown
  ): Promise<number> {
    logger.info(
      `Lambda invoked with government journey id: ${event.govJourneyId}`
    );
    if (!event.dateTime) {
      throw new Error("Invalid event object: missing dateTime");
    }
    const unit = event.unit ?? "seconds";
    const timestamp = new Date(event.dateTime).getTime();

    if (isNaN(timestamp)) {
      throw new Error("Invalid date format");
    }
    if (!["seconds", "milliseconds"].includes(unit)) {
      throw new Error(`Invalid unit value: ${unit}`);
    }

    return unit === "milliseconds" ? timestamp : Math.floor(timestamp / 1000);
  }
}

const handlerClass = new EpochTimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
