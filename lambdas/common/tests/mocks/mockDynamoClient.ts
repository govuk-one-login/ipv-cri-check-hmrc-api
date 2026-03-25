import { vi } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const mockSend = vi.fn();

export const mockDynamoClient = {
  send: mockSend,
} as unknown as DynamoDBClient;
