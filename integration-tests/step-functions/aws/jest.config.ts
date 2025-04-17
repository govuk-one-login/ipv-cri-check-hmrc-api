import type { Config } from "jest";
import baseConfig from "../../jest.config";

export default {
  ...baseConfig,
  projects: [],
  displayName: "integration-tests/step-functions/aws",
  setupFiles: ["<rootDir>/setEnvVars.js"],
  globalSetup: "../../globalStackOutputSetup.ts",
} satisfies Config;
