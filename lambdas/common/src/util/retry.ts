import { Logger } from "@aws-lambda-powertools/logger";

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {},
  logger: Logger = new Logger()
): Promise<T> {
  const { maxRetries = 3, baseDelay = 300, shouldRetry = () => true } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        logger.info(
          `Failed to execute callback '${fn.name}' after ${attempt} retries.`
        );
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      logger.info(
        `Failed to execute callback '${fn.name}' (retry attempt ${attempt}). Waiting ${delay} ms and retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Exceeded maximum retries");
}
