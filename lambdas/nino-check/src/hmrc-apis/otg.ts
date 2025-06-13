import { Logger } from "@aws-lambda-powertools/logger";
import { MetricsHelper } from "../../../logging/metrics-helper";
import { OtgTokenResponse } from "./types/otg";
import { OtgConfig } from "../types/input";

export async function getTokenFromOtg(
  { apiUrl }: OtgConfig,
  logger: Logger,
  metricsHelper: MetricsHelper
): Promise<OtgTokenResponse> {
  const requestStartTime = Math.floor(performance.now());
  const response = await fetch(apiUrl, {
    method: "GET",
  });

  const latency = metricsHelper.captureResponseLatency(
    requestStartTime,
    "OTGHandler"
  );
  logger.info({
    message: "OTG API response received",
    url: apiUrl,
    status: response.status,
    latencyInMs: latency,
  });

  if (response.ok) {
    const body = (await response.json()) as OtgTokenResponse;
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
}
