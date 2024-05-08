interface RetryConfig {
  intervalInMs?: number;
  maxRetries?: number;
  swallowError?: boolean;
  quiet?: boolean;
}
export const pause = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const retry = async <T>(
  config: RetryConfig,
  fn: () => Promise<T>
): Promise<T> => {
  const { intervalInMs = 1000, maxRetries = 10 } = config;
  try {
    return await fn();
  } catch (err) {
    if (!config.quiet) {
      // eslint-disable-next-line no-console
      console.warn(
        `Retrying after ${
          intervalInMs / 1000
        } seconds. ${maxRetries} retries left.`
      );
      // eslint-disable-next-line no-console
      console.warn(err instanceof Error ? err.message : err);
    }
    if (maxRetries === 0) {
      config && config.swallowError
        ? await Promise.resolve()
        : Promise.reject(err);
      throw err;
    }
    await pause(intervalInMs);
    return retry({ ...config, maxRetries: maxRetries - 1 }, fn);
  }
};

export { RetryConfig, retry, pause as wait };
