import { Logger } from "@aws-lambda-powertools/logger";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { Context } from "aws-lambda";
import { MatchEvent } from "./match-event";
import { MetricDimensions, MetricNames } from "./metric-types";

export const logger = new Logger();
const metrics = new Metrics();

export class MatchingHandler implements LambdaInterface {
  public async handler(
    event: MatchEvent,
    context: Context
  ): Promise<{ status: string; body: string; txn: string }> {
    try {
      const requestStartTime = Math.floor(performance.now());
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
      const latency = captureResponseLatency(requestStartTime);
      logger.info({
        message: "API response received",
        url: event.apiURL,
        status: response.status,
        latencyInMs: latency,
      });

      const txn = response.headers.get("x-amz-cf-id") ?? "";
      addLogEntry(event, txn, context);
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        let responseBody;
        try {
          responseBody = await response.json();
        } catch (error) {
          responseBody = {
            message: await response.text(),
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
    txn: txn,
  });
  logger.info(
    `${context.functionName} invoked with government journey id: ${event.user.govuk_signin_journey_id}`
  );
}

function captureResponseLatency(start: number): number {
  const latency = Math.floor(performance.now()) - start;

  const singleMetric = metrics.singleMetric();
  singleMetric.addDimension(MetricDimensions.HTTP, "MatchingHandler");
  singleMetric.addMetric(
    MetricNames.ResponseLatency,
    MetricUnits.Milliseconds,
    latency
  );

  return latency;
}
