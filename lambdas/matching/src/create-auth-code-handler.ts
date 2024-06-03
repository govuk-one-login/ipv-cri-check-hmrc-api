import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";

const logHelper = new LogHelper();
const DEFAULT_AUTHORIZATION_CODE_TTL_IN_MILLIS = 600 * 1000;

export class CreateAuthCodeHandler implements LambdaInterface {
  public async handler(
    event: { govuk_signin_journey_id: string },
    context: Context
  ): Promise<{ authCodeExpiry: number }> {
    logHelper.logEntry(context.functionName, event.govuk_signin_journey_id);
    try {
      return {
        authCodeExpiry: Math.floor(
          (Date.now() + DEFAULT_AUTHORIZATION_CODE_TTL_IN_MILLIS) / 1000
        ),
      };
    } catch (error: unknown) {
      let message;
      if (error instanceof Error) message = error.message;
      else message = String(error);
      logHelper.logError(
        context.functionName,
        event.govuk_signin_journey_id,
        message
      );
      throw error;
    }
  }
}

const handlerClass = new CreateAuthCodeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
