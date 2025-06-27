import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { PdvApiErrorBody, PdvApiInput, PdvApiResponseBody, PdvConfig, PdvFunctionOutput } from "./types/pdv";
import { logger } from "../../../common/src/util/logger";
import { captureLatency } from "../../../common/src/util/metrics";
import { safeStringifyError } from "../../../common/src/util/stringify-error";

export function buildPdvInput(personIdentity: PersonIdentityItem, nino: string): PdvApiInput {
  let firstName = "";
  let lastName = "";

  for (const name of personIdentity.names) {
    for (const namePart of name.nameParts) {
      const { type, value } = namePart;

      switch (type) {
        case "FamilyName": {
          lastName = [lastName, value].join(" ").trim();
          break;
        }
        case "GivenName": {
          if (firstName === "" && value) {
            firstName = value.trim();
          }
          break;
        }
      }
    }
  }
  if (!firstName) {
    throw new Error("First Name is blank");
  }
  if (!lastName) {
    throw new Error("Last Name is blank");
  }

  return {
    firstName,
    lastName,
    dateOfBirth: personIdentity.birthDates[0].value,
    nino,
  };
}

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
      logger.info(
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
