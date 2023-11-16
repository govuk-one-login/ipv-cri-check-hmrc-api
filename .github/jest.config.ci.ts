import baseConfig from "../jest.config";

export default {
  ...baseConfig,
  rootDir: "..",
  reporters: [["github-actions", { silent: false }], "summary"],
};
