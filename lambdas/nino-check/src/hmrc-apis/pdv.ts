import { PdvApiErrorBody, PdvApiErrorJSON, PdvApiInput, PdvConfig, ParsedPdvMatchResponse } from "./types/pdv";
import { logger } from "../../../common/src/util/logger";
import { captureLatency } from "../../../common/src/util/metrics";
import { safeStringifyError } from "../../../common/src/util/stringify-error";

export async function callPdvMatchingApi(
  { apiUrl, userAgent }: PdvConfig,
  oAuthToken: string,
  apiInput: PdvApiInput
): Promise<ParsedPdvMatchResponse> {
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

  let errorBody: PdvApiErrorBody = "";
  if (response.status !== 200) {
    errorBody = await parsePdvErrorBody(response);
  }

  return {
    httpStatus: response.status,
    txn,
    errorBody,
  };
}

async function parsePdvErrorBody(response: Response): Promise<PdvApiErrorBody> {
  const contentType = response.headers.get("content-type");

  if (response.status >= 500) {
    // 5xx errors from HMRC sometimes contain PII
    return "Internal server error";
  }

  const responseBody = await response.text();
  if (contentType?.includes("application/json")) {
    try {
      const json = JSON.parse(responseBody);
      if ("errors" in json) {
        return { type: "matching_error", errorMessage: json.errors } as PdvApiErrorJSON;
      } else if ("code" in json && json.code === "INVALID_CREDENTIALS") {
        return { type: "invalid_creds", errorMessage: json.code } as PdvApiErrorJSON;
      } else {
        logger.error("Unknown JSON response structure received from the Pdv request");
      }
    } catch (error) {
      logger.error(
        `Received a non-json body for the application/json content-type (error: ${safeStringifyError(error)})`
      );
    }
  }
  return responseBody;
}
