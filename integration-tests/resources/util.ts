interface RetryConfig {
  intervalInMs?: number;
  maxRetries?: number;
  swallowError?: boolean;
  quiet?: boolean;
}

export const pause = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const retry = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = { intervalInMs: 1000, maxRetries: 3 }
): Promise<T> => {
  const { intervalInMs = 1000, maxRetries = 3, swallowError, quiet } = config;

  try {
    return await fn();
  } catch (err) {
    const interval = intervalInMs / 1000;

    if (!quiet) {
      // eslint-disable-next-line no-console
      console.warn(
        `Retrying after ${interval} seconds. ${maxRetries} retries left.`
      );
      // eslint-disable-next-line no-console
      console.warn(err instanceof Error ? err.message : err);
    }

    if (maxRetries <= 0) {
      if (swallowError) {
        return (await Promise.resolve()) as unknown as T;
      } else {
        throw err;
      }
    }

    await pause(interval);
    return retry(fn, { ...config, maxRetries: maxRetries - 1 });
  }
};

export { RetryConfig, retry };
