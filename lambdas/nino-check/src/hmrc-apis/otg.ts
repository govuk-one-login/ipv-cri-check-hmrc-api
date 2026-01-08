import { OtgConfig, OtgTokenResponse } from "./types/otg";
import { logger } from "@govuk-one-login/cri-logger";
import { captureLatency } from "../../../common/src/util/metrics";

export async function getTokenFromOtg({ apiUrl }: OtgConfig): Promise<string> {
  const [response, latency] = await captureLatency("OTGHandler", () =>
    fetch(apiUrl, {
      method: "GET",
    })
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
    return body.token;
  }

  throw new Error(`Error response received from OTG ${response.status} ${response.statusText}`);
}
