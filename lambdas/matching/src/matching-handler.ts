import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export class MatchingHandler implements LambdaInterface {
  public async handler(event: MatchEvent, _context: unknown): Promise<any> {
    try {
      const response = await fetch(event.apiURL.value, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": event.userAgent.value,
          Authorization: "Bearer " + event.oAuthToken.value,
        },
        body: JSON.stringify({
          firstName: event.userDetails.Items[0].firstName.S,
          lastName: event.userDetails.Items[0].lastName.S,
          dateOfBirth: event.userDetails.Items[0].dob.S,
          nino: event.nino,
        }),
      });
      return await response.json();
    } catch (error: any) {
      logger.error("Error in MatchingHandler: " + error.message);
      throw error;
    }
  }
}

const handlerClass = new MatchingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
