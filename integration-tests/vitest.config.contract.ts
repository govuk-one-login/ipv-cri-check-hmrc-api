import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../vitest.config.base";

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ["./api-gateway/contract/**/*.test.ts"],
    exclude: [],
    globalSetup: ["./globalStackOutputSetup.ts"],
    environment: "node",
    threads: false,
    coverage: { enabled: false },
  },
}));
