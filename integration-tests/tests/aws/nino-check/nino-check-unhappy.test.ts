import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
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
  sessionId: "123456789",
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
  await secretsManager.updateSecret({
    SecretId: "HMRCBearerToken",
    SecretString: "goodToken",
  });

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

afterEach(
  async () =>
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
      },
      {
        tableName: output.NinoAttemptsTable as string,
        items: { id: input.sessionId },
      }
    )
);

it("should fail when there is more than 2 nino check attempts", async () => {
  await populateTable(output.NinoAttemptsTable as string, {
    id: input.sessionId,
    attempts: 2,
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

it("should fail when user record already present in nino user table", async () => {
  await populateTable(output.NinoUsersTable as string, {
    sessionId: "123456789",
    nino: "AA000003D",
  });

  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    {
      sessionId: "123456789",
      nino: "AA000003D",
    }
  );

  expect(startExecutionResult.status).toBe("FAILED");
});

it("should fail when user nino does not match with HMRC DB", async () => {
  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.output).toBe(
    '{"error":"CID returned no record"}'
  );
});

it("should throw an error when url is unavailable", async () => {
  const urlParameterName = `/${process.env.STACK_NAME}/NinoCheckUrl`;
  const currentURL = (await getSSMParameter(urlParameterName)) as string;

  await updateSSMParameter(urlParameterName, "bad-url");

  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    input
  );

  await updateSSMParameter(urlParameterName, currentURL);

  expect(startExecutionResult.status).toEqual("FAILED");
});

it("should throw an error when token is invalid", async () => {
  await secretsManager.updateSecret({
    SecretId: "HMRCBearerToken",
    SecretString: "badToken",
  });

  const startExecutionResult = await executeStepFunction(
    output.NinoCheckStateMachineArn as string,
    input
  );

  expect(startExecutionResult.status).toEqual("FAILED");
});
