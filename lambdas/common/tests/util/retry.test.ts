import { withRetry } from "../../src/util/retry";
import { mockLogger } from "../logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("withRetry", { timeout: 30_000 /* 30s */ }, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn, mockLogger);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry up to maxRetries on failure and eventually succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("final success");

    const promise = withRetry(fn, mockLogger, {
      maxRetries: 3,
      baseDelay: 100,
    });

    for (let i = 0; i < 2; i++) {
      await Promise.resolve();
      vi.advanceTimersByTime(100 * Math.pow(2, i));
    }

    await Promise.resolve(); // Flush pending microtasks
    vi.runOnlyPendingTimers();

    const result = await promise;
    expect(result).toBe("final success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw error if all retries fail", async () => {
    const error = new Error("always fails");
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn, mockLogger, { maxRetries: 2, baseDelay: 50 });

    for (let i = 0; i < 2; i++) {
      await Promise.resolve();
      vi.advanceTimersByTime(50 * Math.pow(2, i));
    }

    await Promise.resolve();
    vi.runOnlyPendingTimers();

    await expect(promise).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should not retry if shouldRetry returns false", async () => {
    const error = new Error("fatal");
    const fn = vi.fn().mockRejectedValue(error);

    const shouldRetry = vi.fn().mockReturnValue(false);
    await expect(withRetry(fn, mockLogger, { maxRetries: 3, shouldRetry })).rejects.toThrow("fatal");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error, 0);
  });

  it("should retry only while shouldRetry returns true", async () => {
    const error = new Error("transient");
    const fn = vi.fn().mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockResolvedValue("recovered");

    const shouldRetry = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(true);

    const promise = withRetry(fn, mockLogger, {
      maxRetries: 5,
      baseDelay: 10,
      shouldRetry,
    });

    for (let i = 0; i < 2; i++) {
      await Promise.resolve();
      vi.advanceTimersByTime(10 * Math.pow(2, i));
    }

    await Promise.resolve();
    vi.runOnlyPendingTimers();

    const result = await promise;
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(shouldRetry).toHaveBeenCalledTimes(2);
  });

  it("should use exponential backoff correctly", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail 1")).mockResolvedValue("success");

    const baseDelay = 100;
    const promise = withRetry(fn, mockLogger, { maxRetries: 2, baseDelay });

    await Promise.resolve();

    vi.advanceTimersByTime(baseDelay);
    await Promise.resolve();
    vi.runOnlyPendingTimers();

    const result = await promise;
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
