import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export class OTGApiHandler implements LambdaInterface {
  public async handler(
    event: { apiURL: string },
    _context: unknown
  ): Promise<{ token: string, expiry: number }> {
    try {
      const response = await fetch(event.apiURL, {
        method: "GET",
      });

      if(response.ok) {
        const body = await response.json();
        const expiry = body.expiry;
        const now = Date.now();
        if(now > expiry) {
          throw new Error("OTG returned an expired Bearer Token")
        }
        return body;
      }

      throw new Error(
        `Error response received from OTG ${response.status} ${response.statusText}`)
    } catch (error: unknown) {
      const message = (error instanceof Error) ? error.message : String(error);
      logger.error("Error in OTGApiHandler: " + message);
      throw error;
    }
  }
}

const handlerClass = new OTGApiHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
