import { stackOutputs } from "./resources/cloudformation-helper";
let outputs: Partial<{
  CommonStackName: string;
  StackName: string;
  PrivateApiGatewayId: string;
  PublicApiGatewayId: string;
  NinoUsersTable: string;
  UserAttemptsTable: string;
}>;

export default async function globalSetup() {
  try {
    const stackName = process.env.STACK_NAME;
    if (!stackName) throw new Error("STACK_NAME environment variable is not set.");

    outputs = await stackOutputs(stackName);
    if (!outputs?.CommonStackName) throw new Error("Missing CommonStackName in stack outputs.");

    process.env.AWS_REGION = "eu-west-2";
    process.env.COMMON_STACK_NAME = outputs.CommonStackName;
    process.env.STACK_NAME = outputs.StackName;
    process.env.PRIVATE_API = outputs.PrivateApiGatewayId || "";
    process.env.PUBLIC_API = outputs.PublicApiGatewayId || "";
    process.env.NINO_USERS_TABLE = outputs.NinoUsersTable || "check-hmrc-cri-api-nino-users";
    process.env.USERS_ATTEMPTS_TABLE = outputs.UserAttemptsTable || "check-hmrc-cri-api-user-attempts";
    process.env.PERSON_IDENTITY_TABLE =
      `person-identity-${outputs.CommonStackName}` || "person-identity-common-cri-api";
    process.env.SESSION_TABLE = `session-${outputs.CommonStackName}` || "session-common-cri-api";

    const testResourcesStackName = process.env.TEST_RESOURCES_STACK_NAME ?? "test-resources";
    process.env.TEST_RESOURCES_STACK_NAME = testResourcesStackName;
    const testResourcesStackOutputs = await stackOutputs(testResourcesStackName);
    if (!testResourcesStackOutputs?.TestHarnessExecuteUrl) throw new Error(`Missing test harness URL.`);

    // Includes trailing slash.
    process.env.TEST_HARNESS_EXECUTE_URL = testResourcesStackOutputs.TestHarnessExecuteUrl;

    // eslint-disable-next-line no-console
    console.log("✅ Env vars set in globalSetup");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to set up environment for tests:", error);
    throw error;
  }
}
