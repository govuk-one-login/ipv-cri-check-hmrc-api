import type { Config } from "jest";
import baseConfig from "../jest.config";

export default {
  ...baseConfig,
  projects: [],
  displayName: "integration-tests/api-gateway",
} satisfies Config;
