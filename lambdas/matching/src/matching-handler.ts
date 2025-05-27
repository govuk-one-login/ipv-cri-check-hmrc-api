import { Logger } from "@aws-lambda-powertools/logger";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Context } from "aws-lambda";
import { LogHelper } from "../../logging/log-helper";
import { MetricsHelper } from "../../logging/metrics-helper";
import { MatchEvent } from "./match-event";
import { Names } from "./name-part";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";

initOpenTelemetry();

const metricsHelper = new MetricsHelper();

export class MatchingHandler implements LambdaInterface {
  logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  public async handler(
    event: MatchEvent,
    context: Context
  ): Promise<{ status: string; body: string; txn: string }> {
    const logHelper = new LogHelper(context, this.logger);
    logHelper.logEntry(
      context.functionName,
      event.user.govuk_signin_journey_id
    );

    try {
      const namePart = extractName(event.userDetails.names);

      if (!namePart.firstName) {
        throw new Error("First Name is blank");
      }
      if (!namePart.lastName) {
        throw new Error("Last Name is blank");
      }

      const requestStartTime = Math.floor(performance.now());
      const response = await fetch(event.apiURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": event.userAgent,
          Authorization: "Bearer " + event.oAuthToken,
        },
        body: JSON.stringify({
          firstName: namePart.firstName,
          lastName: namePart.lastName,
          dateOfBirth: event.userDetails.dob,
          nino: event.nino,
        }),
      });

      const latency = metricsHelper.captureResponseLatency(
        requestStartTime,
        "MatchingHandler"
      );
      this.logger.info({
        message: "HMRC API response received",
        url: event.apiURL,
        status: response.status,
        latencyInMs: latency,
      });

      const txn = response.headers.get("x-amz-cf-id") ?? "";
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        let responseBody = await response.text();

        try {
          responseBody = JSON.parse(responseBody);
        } catch (error) {
          this.logger.info(
            "Received a non-json body for the application/json content-type"
          );
        }

        if (response.status >= 500) {
          return {
            status: response.status.toString(),
            body: "Internal server error",
            txn: txn,
          };
        }

        return {
          status: response.status.toString(),
          body: responseBody,
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
      this.logger.error({
        message: `Error in ${context.functionName}: ${message}`,
        govuk_signin_journey_id: event.user.govuk_signin_journey_id,
      });
      throw error;
    }
  }
}

function extractName(name: Names): { firstName: string; lastName: string } {
  let firstName = "";
  let surname = "";
  for (const person of name.L) {
    for (const namePart of person.M.nameParts.L) {
      const type = namePart.M.type?.S;
      const value = namePart.M.value?.S;
      if (type === "FamilyName") {
        surname = (surname + " " + value).trim();
      } else if (type === "GivenName" && firstName === "" && value) {
        firstName = value.trim();
      }
    }
  }
  return {
    firstName: firstName.trim(),
    lastName: surname.trim(),
  };
}

const handlerClass = new MatchingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
