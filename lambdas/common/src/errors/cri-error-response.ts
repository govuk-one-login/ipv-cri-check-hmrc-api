import { Logger } from "@aws-lambda-powertools/logger";
import { CriError } from "./cri-error";

export function handleErrorResponse(err: unknown, logger: Logger) {
  if (err instanceof CriError) {
    logger.error("Cri Error thrown: " + err.message);
    if (err.status >= 500) {
      return formatResponse(err.status, "Internal server error");
    }
    return formatResponse(err.status, err.message);
  } else if (err instanceof Error) {
    logger.error("Error thrown: " + err.name);
  } else {
    logger.error("Unknown error thrown");
  }
  return formatResponse(500, "Internal server error");
}

function formatResponse(statusCode: number, message: string) {
  if (message !== "") {
    message = JSON.stringify({ message: message });
  }
  return {
    statusCode,
    body: message,
  };
}
