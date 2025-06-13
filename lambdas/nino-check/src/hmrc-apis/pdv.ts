import { MetricsHelper } from "../../../logging/metrics-helper";
import {
  PersonIdentityItem,
  PersonIdentityName,
} from "../../../common/src/database/types/person-identity";
import {
  PdvApiErrorBody,
  PdvApiInput,
  PdvApiResponseBody,
  PdvFunctionOutput,
} from "./types/pdv";
import { Logger } from "@aws-lambda-powertools/logger";
import { PdvConfig } from "../types/input";

export async function matchUserDetailsWithPdv(
  { apiUrl, userAgent }: PdvConfig,
  oAuthToken: string,
  personIdentity: PersonIdentityItem,
  nino: string,
  logger: Logger,
  metricsHelper: MetricsHelper
): Promise<PdvFunctionOutput> {
  const { firstName, lastName } = extractName(personIdentity.names);

  if (!firstName) {
    throw new Error("First Name is blank");
  }
  if (!lastName) {
    throw new Error("Last Name is blank");
  }

  const apiInput: PdvApiInput = {
    firstName,
    lastName,
    dateOfBirth: personIdentity.birthDates[0].value,
    nino,
  };

  const requestStartTime = Math.floor(performance.now());
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
      Authorization: `Bearer ${oAuthToken}`,
    },
    body: JSON.stringify(apiInput),
  });

  const latency = metricsHelper.captureResponseLatency(
    requestStartTime,
    "MatchingHandler"
  );
  logger.info({
    message: "HMRC API response received",
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
    } catch (error: unknown) {
      logger.info(
        `Received a non-json body for the application/json content-type (error: ${error})`
      );
    }

    if (response.status >= 500) {
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

function extractName(names: PersonIdentityName[]): {
  firstName: string;
  lastName: string;
} {
  let firstName = "";
  let surname = "";

  for (const name of names) {
    for (const namePart of name.nameParts) {
      const { type, value } = namePart;

      switch (type) {
        case "FamilyName": {
          surname = [surname, value].join(" ").trim();
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

  return {
    firstName: firstName.trim(),
    lastName: surname.trim(),
  };
}
