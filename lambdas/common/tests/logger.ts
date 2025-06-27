import { Logger } from "@aws-lambda-powertools/logger";

export const mockLogger = {
  injectLambdaContext: jest.fn(),
  addContext: jest.fn(),
  resetKeys: jest.fn(),
  appendKeys: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  critical: jest.fn(),
} as unknown as Logger;
