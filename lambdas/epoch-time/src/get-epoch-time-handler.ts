import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";

interface EpochTimeEvent {
  govJourneyId: string;
}

const logHelper = new LogHelper();

export class EpochTimeHandler implements LambdaInterface {
  public async handler(event: EpochTimeEvent, context: Context) {
    logHelper.logEntry(context.functionName, event.govJourneyId);

    const timestamp = Date.now();

    return {
      milliseconds: timestamp,
      seconds: Math.floor(timestamp / 1000),
    };
  }
}

const handlerClass = new EpochTimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
