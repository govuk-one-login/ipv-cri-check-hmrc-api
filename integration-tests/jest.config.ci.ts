import type { Config } from "jest";
import baseConfig from "./jest.config";

export default {
  ...baseConfig,
  reporters: [["github-actions", { silent: false }], "default"],
} satisfies Config;
