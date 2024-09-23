import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { TimeEvent } from "./time-event";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";
import { EpochFunctionMap, getEpochFunctionMap } from "./epoch-factory";

export class TimeHandler implements LambdaInterface {
  constructor(
    private readonly logger: LogHelper = new LogHelper(),
    private readonly epochFunctions: EpochFunctionMap = getEpochFunctionMap()
  ) {}
  public async handler(event: TimeEvent, context: Context) {
    this.logger.logEntry(context.functionName, event.govJourneyId);

    if (Number(event.ttlValue) < 0) {
      throw new Error(`ttlValue must be positive (provided ${event.ttlValue})`);
    }

    try {
      return this.generateEpoch(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.logError(context.functionName, event.govJourneyId, message);

      throw error;
    }
  }

  private generateEpoch(event: TimeEvent) {
    const selectedEpochFunc = this.epochFunctions[event.epochType];
    if (!selectedEpochFunc) throw new Error(`Invalid mode: ${event.epochType}`);

    return selectedEpochFunc(event);
  }
}

const handlerClass = new TimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
