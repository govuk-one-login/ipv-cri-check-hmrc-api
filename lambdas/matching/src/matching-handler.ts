import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { MatchEvent } from "./match-event";
import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export class MatchingHandler implements LambdaInterface {
  public async handler(
    event: MatchEvent,
    context: Context
  ): Promise<{ status: string; body: string;  txn: string }> {
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
      const txn = response.headers.get("x-amz-cf-id") ?? "";
      addLogEntry(event, txn, context);
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return {
          status: response.status.toString(),
          body: await response.json(),
          txn: txn,
        };
      } else {
        return {
          status: response.status.toString(),
          body: await response.text(),
          txn: txn,
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({
        message: `Error in ${context.functionName}: ${message}`,
        govuk_signin_journey_id: event.user.govuk_signin_journey_id,
      });
      throw error;
    }
  }
}

const handlerClass = new MatchingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);

function addLogEntry(event: MatchEvent, txn: string | null, context: Context) {
  logger.appendKeys({
    govuk_signin_journey_id: event.user.govuk_signin_journey_id,
    txn: txn
  });
  logger.info(
    `${context.functionName} invoked with government journey id: ${event.user.govuk_signin_journey_id}`
  );
}
