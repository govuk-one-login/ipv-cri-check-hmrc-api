import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();
const DEFAULT_AUTHORIZATION_CODE_TTL_IN_MILLIS = 600 * 1000;

export class CreateAuthCodeHandler implements LambdaInterface {
  public async handler(
    _event: unknown,
    _context: unknown
  ): Promise<{ authCodeExpiry: number }> {
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
      logger.error("Error in CreateAuthCodeHandler: " + message);
      throw error;
    }
  }
}

const handlerClass = new CreateAuthCodeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
