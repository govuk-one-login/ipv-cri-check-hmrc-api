import { Config } from "jest";
import baseConfig from "../jest.config.base";

export default {
  ...baseConfig,
  projects: ["tests/*/jest.config.*.ts"],
  testMatch: ["**/*.test.ts"],
  collectCoverage: false,
  modulePaths: [],
} satisfies Config;
