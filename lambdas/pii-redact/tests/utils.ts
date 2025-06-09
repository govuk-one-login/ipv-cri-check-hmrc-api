import { Logger } from "@aws-lambda-powertools/logger";

export const mockLogger = {
  info: jest.fn(),
  critical: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as Logger;
