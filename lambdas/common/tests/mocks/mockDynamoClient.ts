import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { vi } from "vitest";

export const mockDynamoClient = {
  send: vi.fn(),
} as unknown as DynamoDBClient;

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(function () {
    // class constructors must be mocked with function syntax, not arrow syntax
    // https://vitest.dev/guide/migration.html#spyon-and-fn-support-constructors
    return mockDynamoClient;
  }),
}));
