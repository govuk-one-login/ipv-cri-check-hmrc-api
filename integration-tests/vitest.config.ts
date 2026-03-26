import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../vitest.config.base";

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ["./api-gateway/**/*.test.ts"],
    exclude: ["**/contract/**"],
    globalSetup: ["./globalStackOutputSetup.ts"],
    environment: "node",
    threads: false,
    coverage: { enabled: false }
  },
}));
