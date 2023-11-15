import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  projects: ["lambdas/*/jest.config.ts"],
};
export default config;
