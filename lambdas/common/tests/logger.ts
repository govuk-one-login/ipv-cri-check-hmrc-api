import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";
import { ISO8601DateString } from "../src/types/brands";

export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  critical: jest.fn(),
} as unknown as Logger;

export const mockLogHelper = {
  context: {} as Context,
  govJourneyId: "my-journey",
  logger: mockLogger,
  handlerStartTime: new Date().toISOString() as ISO8601DateString,
  logEntry: jest.fn(),
  logError: jest.fn(),
};
