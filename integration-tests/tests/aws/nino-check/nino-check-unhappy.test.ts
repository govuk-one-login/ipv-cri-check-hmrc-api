import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItems,
  clearItemsFromTables,
  populateTable,
  populateTables,
} from "../resources/dynamodb-helper";
import {
  getSSMParameter,
  updateSSMParameter,
} from "../resources/ssm-param-helper";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

jest.setTimeout(30_000);

const secretsManager = new SecretsManager();

const input = {
  sessionId: "check-unhappy",
  nino: "AB123003C",
};

const testUser = {
  nino: "AB123003C",
  dob: "1948-04-23",
  firstName: "Jim",
  lastName: "Ferguson",
};

let output: Partial<{
  CommonStackName: string;
  NinoAttemptsTable: string;
  NinoUsersTable: string;
  NinoCheckStateMachineArn: string;
}>;

let sessionTableName: string;
let personIdentityTableName: string;

beforeEach(async () => {
  output = await stackOutputs(process.env.STACK_NAME);
  sessionTableName = `session-${output.CommonStackName}`;
  personIdentityTableName = `person-identity-${output.CommonStackName}`;

  await populateTables(
    {
      tableName: sessionTableName,
      items: {
        sessionId: input.sessionId,
        expiryDate: 9999999999,
      },
    },
    {
      tableName: personIdentityTableName,
      items: {
        sessionId: input.sessionId,
        nino: input.nino,
        birthDates: [{ value: testUser.dob }],
        names: [
          {
            nameParts: [
              {
                type: "GivenName",
                value: testUser.firstName,
              },
              {
                type: "FamilyName",
                value: testUser.lastName,
              },
            ],
          },
        ],
      },
    }
  );
});

afterEach(async () => {
  await clearItemsFromTables(
    {
      tableName: sessionTableName,
      items: { sessionId: input.sessionId },
    },
    {
      tableName: personIdentityTableName,
      items: { sessionId: input.sessionId },
    },
    {
      tableName: output.NinoUsersTable as string,
      items: { sessionId: input.sessionId },
    }
  );
  await clearAttemptsTable(input.sessionId, output.NinoAttemptsTable);
});

it("should fail when there is more than 2 nino check attempts", async () => {
  await populateTable(output.NinoAttemptsTable as string, {
    sessionId: input.sessionId,
    timestamp: Date.now().toString(),
  });

  await populateTable(output.NinoAttemptsTable as string, {
    sessionId: input.sessionId,
    timestamp: Date.now().toString(),
  });

  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"Maximum number of attempts exceeded"}'
  );
});

it("should fail when there is no user present for given nino", async () => {
  await clearItems(personIdentityTableName, {
    sessionId: input.sessionId,
  });

  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"No user found for given nino"}'
  );
});

it("should fail when session id is invalid", async () => {
  await clearItems(sessionTableName, {
    sessionId: input.sessionId,
  });

  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"Session is not valid or has expired"}'
  );

  expect(startExecutionResult.status).toBe("SUCCEEDED");
});

it("should fail when user NINO does not match with HMRC DB", async () => {
  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe('{"httpStatus":"424"}');
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
      output.NinoCheckStateMachineArn as string,
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
      output.NinoCheckStateMachineArn as string,
      input
    );

    expect(startExecutionResult.status).toEqual("FAILED");
  });
});
