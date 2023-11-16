import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { TimeEvent } from "./time-event";

const logger = new Logger();

enum Unit {
  Seconds = "seconds",
  Minutes = "minutes",
  Hours = "hours",
  Days = "days",
  Months = "months",
  Years = "years",
  None = "none",
}

export class TimeHandler implements LambdaInterface {
  private readonly timeInSecs: number;

  constructor() {
    this.timeInSecs = this.msToSeconds(Date.now());
  }

  private msToSeconds(ms: number): number {
    return Math.floor(ms / 1000);
  }

  private convert(unit: Unit): number {
    switch (unit) {
      case Unit.Seconds:
        return 1000;
      case Unit.Minutes:
        return 1000 * 60;
      case Unit.Hours:
        return 1000 * 60 * 60;
      case Unit.Days:
        return 1000 * 60 * 60 * 24;
      case Unit.Months:
        return 1000 * 60 * 60 * 24 * 30;
      case Unit.Years:
        return 1000 * 60 * 60 * 24 * 365;
      case Unit.None:
        return 1;
      default:
        throw new Error(`Unexpected time-to-live unit encountered: ${unit}`);
    }
  }

  private parseUnit(value?: string): Unit {
    const unit = value?.toLowerCase() as Unit;
    if (Object.values(Unit).includes(unit)) {
      return unit;
    }
    throw new Error(`ttlUnit must be valid: ${value}`);
  }

  public async handler(
    event: TimeEvent,
    _context: unknown
  ): Promise<{ nbf: number; expiry: number }> {
    try {
      return {
        nbf: this.notBeforeDate(),
        expiry: this.expiryDate(event.ttl, event.ttlUnit),
      };
    } catch (error: unknown) {
      let message;
      if (error instanceof Error) message = error.message;
      else message = String(error);
      logger.error("Error in TimeHandler: " + message);
      throw error;
    }
  }

  private expiryDate = (ttl: number, unit: string): number => {
    const convertedTTL = ttl * this.convert(this.parseUnit(unit));
    return this.timeInSecs + convertedTTL;
  };

  private notBeforeDate = (): number => this.timeInSecs;
}

const handlerClass = new TimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
