import type { Config } from "jest";

export default {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  maxWorkers: 1,
  clearMocks: true,
  collectCoverageFrom: ["../step_functions/**/*.{js,ts}", "!**/tests/**"],
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: ["config.ts", "node_modules/"],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
} satisfies Config;
