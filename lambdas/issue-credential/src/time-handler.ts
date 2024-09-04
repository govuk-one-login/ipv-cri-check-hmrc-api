import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { TimeEvent } from "./time-event";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";
import { getEpochFunctions } from "./epoch-categories";

const logHelper = new LogHelper();
type EpochFunction = Record<string, (event: TimeEvent) => object>;

export class TimeHandler implements LambdaInterface {
  constructor(
    private readonly epochFunctions: EpochFunction = getEpochFunctions()
  ) {}
  public async handler(event: TimeEvent, context: Context) {
    logHelper.logEntry(context.functionName, event.govJourneyId);

    if (Number(event.ttlValue) < 0) {
      throw new Error(`ttlValue must be positive (provided ${event.ttlValue})`);
    }

    try {
      return this.generateEpoch(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logHelper.logError(context.functionName, event.govJourneyId, message);

      throw error;
    }
  }

  private generateEpoch(event: TimeEvent) {
    const epochFunc = this.epochFunctions[event.epochMode];
    if (!epochFunc) throw new Error(`Invalid mode: ${event.epochMode}`);

    return epochFunc(event);
  }
}

const handlerClass = new TimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
