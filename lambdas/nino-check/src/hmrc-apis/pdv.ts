import { PdvApiErrorBody, PdvApiInput, PdvApiResponseBody, PdvConfig, PdvFunctionOutput } from "./types/pdv";
import { logger } from "../../../common/src/util/logger";
import { captureLatency } from "../../../common/src/util/metrics";
import { safeStringifyError } from "../../../common/src/util/stringify-error";

export async function matchUserDetailsWithPdv(
  { apiUrl, userAgent }: PdvConfig,
  oAuthToken: string,
  apiInput: PdvApiInput
): Promise<PdvFunctionOutput> {
  const [response, latency] = await captureLatency("MatchingHandler", () =>
    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": userAgent,
        Authorization: `Bearer ${oAuthToken}`,
      },
      body: JSON.stringify(apiInput),
    })
  );

  logger.info({
    message: "PDV API response received",
    url: apiUrl,
    status: response.status,
    latencyInMs: latency,
  });

  const txn = response.headers.get("x-amz-cf-id") ?? "";
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    const responseBody = await response.text();
    let parsedBody: PdvApiResponseBody | PdvApiErrorBody | undefined;

    try {
      parsedBody = JSON.parse(responseBody);
    } catch (error) {
      logger.error(
        `Received a non-json body for the application/json content-type (error: ${safeStringifyError(error)})`
      );
    }

    if (response.status >= 500) {
      // 5xx errors from HMRC sometimes contain PII
      return {
        httpStatus: response.status,
        body: "Internal server error",
        txn: txn,
      };
    }

    return {
      httpStatus: response.status,
      body: responseBody,
      parsedBody,
      txn: txn,
    };
  } else {
    return {
      httpStatus: response.status,
      body: await response.text(),
      txn: txn,
    };
  }
}
