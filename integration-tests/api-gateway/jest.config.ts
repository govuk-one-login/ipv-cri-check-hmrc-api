import type { Config } from "jest";
import baseConfig from "../jest.config";

export default {
  ...baseConfig,
  projects: [],
  maxWorkers: 1,
  detectOpenHandles: true,
  displayName: "integration-tests/api-gateway",
  globalSetup: "<rootDir>/api-test-context/setup-integration-context.ts",
  globalTeardown:
    "<rootDir>/api-test-context/setup-integration-context-tear-down.ts",
} satisfies Config;
