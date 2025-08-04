import type { Config } from "jest";
import baseConfig from "../jest.config";

export default {
  ...baseConfig,
  projects: [],
  displayName: "integration-tests/eventbridge",
  globalSetup: "../globalStackOutputSetup.ts",
} satisfies Config;
