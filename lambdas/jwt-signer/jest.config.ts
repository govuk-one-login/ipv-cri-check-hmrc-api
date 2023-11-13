import { Config } from "@jest/types";
import baseConfig from "../../jest.config.base";

const config: Config.InitialOptions = {
  ...baseConfig,
  displayName: "lambdas/jwt-signer",
};
export default config;
