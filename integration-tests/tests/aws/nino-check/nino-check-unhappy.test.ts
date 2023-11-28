import { describeStack, StackInfo } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearItems,
  populateTable,
  populateTables,
} from "../resources/dynamodb-helper";
import {
  getSSMParameter,
  updateSSMParameter,
} from "../resources/ssm-param-helper";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";
import {
  clearSession,
  input as stubInput,
  personIdentityData,
  sessionData,
} from "../resources/session-helper";

const input = stubInput();
const invalidInput = stubInput("AB123003C");
const secretsManager = new SecretsManager();
let stack: StackInfo;

beforeAll(async () => (stack = await describeStack()));

beforeEach(async () => {
  await populateTables(
    personIdentityData(stack, input),
    sessionData(stack, input)
  );
});

afterEach(async () => await clearSession(stack, input));

it("should fail when there is more than 2 nino check attempts", async () => {
  await populateTable(stack.outputs.NinoAttemptsTable as string, {
    id: input.sessionId,
    attempts: 2,
  });

  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"Maximum number of attempts exceeded"}'
  );
});

it("should fail when there is no user present for given nino", async () => {
  await clearItems(stack.personIdentityTableName, {
    sessionId: input.sessionId,
  });

  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"No user found for given nino"}'
  );
});

it("should fail when session id is invalid", async () => {
  await clearItems(stack.sessionTableName, {
    sessionId: input.sessionId,
  });

  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"Session is not valid or has expired"}'
  );

  expect(startExecutionResult.status).toBe("SUCCEEDED");
});

it("should fail when user record already present in nino user table", async () => {
  await populateTable(stack.outputs.NinoUsersTable as string, {
    sessionId: input.sessionId,
    nino: input.nino,
  });

  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    {
      sessionId: input.sessionId,
      nino: input.nino,
    }
  );

  expect(startExecutionResult.status).toBe("FAILED");
});

it("should fail when user NINO does not match with HMRC DB", async () => {
  const startExecutionResult = await executeStepFunction(
    stack.outputs.NinoCheckStateMachineArn as string,
    invalidInput
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"CID returned no record"}'
  );
});

describe("NINO check URL is unavailable", () => {
  const urlParameterName = `/${process.env.STACK_NAME}/NinoCheckUrl`;
  let currentURL: string;

  beforeAll(async () => {
    currentURL = (await getSSMParameter(urlParameterName)) as string;
    await updateSSMParameter(urlParameterName, "bad-url");
  });

  afterAll(async () => await updateSSMParameter(urlParameterName, currentURL));

  it("should throw an error when URL is unavailable", async () => {
    const startExecutionResult = await executeStepFunction(
      stack.outputs.NinoCheckStateMachineArn as string,
      input
    );

    expect(startExecutionResult.status).toEqual("FAILED");
  });
});

describe("HMRC bearer token is invalid", () => {
  beforeAll(
    async () =>
      await secretsManager.updateSecret({
        SecretId: "HMRCBearerToken",
        SecretString: "badToken",
      })
  );

  afterAll(
    async () =>
      await secretsManager.updateSecret({
        SecretId: "HMRCBearerToken",
        SecretString: "goodToken",
      })
  );

  it("should throw an error when token is invalid", async () => {
    const startExecutionResult = await executeStepFunction(
      stack.outputs.NinoCheckStateMachineArn as string,
      input
    );

    expect(startExecutionResult.status).toEqual("FAILED");
  });
});
