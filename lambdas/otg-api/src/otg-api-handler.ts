import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { LogHelper } from "../../logging/log-helper";
import { MetricsHelper } from "../../logging/metrics-helper";
import { Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";

initOpenTelemetry();

const metricsHelper = new MetricsHelper();

export class OTGApiHandler implements LambdaInterface {
  logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  public async handler(
    event: { apiURL: string; govJourneyId: string },
    context: Context
  ): Promise<{ token: string; expiry: number }> {
    const logHelper = new LogHelper(context, this.logger);
    logHelper.logEntry(context.functionName, event.govJourneyId);

    try {
      const requestStartTime = Math.floor(performance.now());
      const response = await fetch(event.apiURL, {
        method: "GET",
      });

      const latency = metricsHelper.captureResponseLatency(
        requestStartTime,
        "OTGHandler"
      );
      this.logger.info({
        message: "OTG API response received",
        url: event.apiURL,
        status: response.status,
        latencyInMs: latency,
      });

      if (response.ok) {
        const body = await response.json();
        const expiry = body.expiry;
        const now = Date.now();
        if (now > expiry) {
          throw new Error("OTG returned an expired Bearer Token");
        }
        return body;
      }

      throw new Error(
        `Error response received from OTG ${response.status} ${response.statusText}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logHelper.logError(context.functionName, event.govJourneyId, message);
      throw error;
    }
  }
}

const handlerClass = new OTGApiHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
