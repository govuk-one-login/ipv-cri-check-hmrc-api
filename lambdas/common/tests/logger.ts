import { Logger } from "@aws-lambda-powertools/logger";
import { vi } from "vitest";

export const mockLogger = {
  injectLambdaContext: vi.fn(() => () => {}),
  addContext: vi.fn(),
  resetKeys: vi.fn(),
  appendKeys: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
} as unknown as Logger;
