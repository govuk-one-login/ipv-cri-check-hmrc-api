import { Config } from "jest";
import baseConfig from "../jest.config.base";

export default {
  ...baseConfig,
  projects: ["tests/*/jest.config.ts"],
  testMatch: ["<rootDir>/**/*.test.ts"],
  collectCoverage: false,
  testTimeout: 30_000,
  modulePaths: [],
} satisfies Config;
