import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { MatchEvent } from "./match-event";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";

const logHelper = new LogHelper();

export class MatchingHandler implements LambdaInterface {
  public async handler(
    event: MatchEvent,
    context: Context
  ): Promise<{ status: string; body: string;  txn: string | null  }> {
    logHelper.logEntry(
      context.functionName,
      event.user.govuk_signin_journey_id
    );
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
      const txn = response.headers.get("x-amz-cf-id");
      logHelper.logEntry("Response header x-amz-cf-id: " + txn, event.user.govuk_signin_journey_id)
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
      let message;
      if (error instanceof Error) message = error.message;
      else message = String(error);
      logHelper.logError(
        context.functionName,
        event.user.govuk_signin_journey_id,
        message
      );
      throw error;
    }
  }
}

const handlerClass = new MatchingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
