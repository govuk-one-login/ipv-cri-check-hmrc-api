import type { CustomMatcher } from "aws-sdk-client-mock-vitest";
declare module "vitest" {
  interface Matchers<T = any> extends CustomMatcher<T> {}
}
