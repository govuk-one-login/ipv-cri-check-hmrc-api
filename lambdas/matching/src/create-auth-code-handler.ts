import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();
const DEFAULT_AUTHORIZATION_CODE_TTL_IN_MILLIS = 600 * 1000;

export class CreateAuthCodeHandler implements LambdaInterface {
  public async handler(
    event: {govuk_signin_journey_id: string},
    _context: unknown
  ): Promise<{ authCodeExpiry: number }> {
    logger.info(`Lambda invoked with government journey id: ${event.govuk_signin_journey_id}`);
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
      logger.error({
        message: "Error in CreateAuthCodeHandler: " + message,
        govJourneyId: event.govuk_signin_journey_id
      });
      throw error;
    }
  }
}

const handlerClass = new CreateAuthCodeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
