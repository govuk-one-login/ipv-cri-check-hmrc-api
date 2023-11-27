import { Config } from "jest";

export default {
  preset: "ts-jest",
  clearMocks: true,
  modulePaths: ["<rootDir>/src"],
  collectCoverageFrom: ["<rootDir>/src/**/*"],
  testPathIgnorePatterns: ["./build/*"],
  testMatch: ["<rootDir>/tests/*"],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
} satisfies Config;
