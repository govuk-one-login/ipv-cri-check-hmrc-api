import { mergeConfig, defineConfig } from "vitest/config";
import baseConfig from "../../vitest.config.base";

export default mergeConfig(baseConfig, defineConfig({
  test: {
    name: "lambdas/common",
    server: {
      deps: {
        inline: ["@govuk-one-login/cri-metrics"],
      },
    },
  },
}));
