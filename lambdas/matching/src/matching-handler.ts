import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { MatchEvent } from "./match-event";

const logger = new Logger();

export class MatchingHandler implements LambdaInterface {
  public async handler(event: MatchEvent, _context: unknown): Promise<string> {
    try {
      const response = await fetch(event.apiURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": event.userAgent,
          Authorization: "Bearer " + event.oAuthToken,
        },
        body: JSON.stringify({
          firstName: event.userDetails.firstName,
          lastName: event.userDetails.lastName,
          dateOfBirth: event.userDetails.dob,
          nino: event.nino,
        }),
      });
      return await response.json();
    } catch (error: unknown) {
      let message;
      if (error instanceof Error) message = error.message;
      else message = String(error);
      logger.error("Error in MatchingHandler: " + message);
      throw error;
    }
  }
}

const handlerClass = new MatchingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
