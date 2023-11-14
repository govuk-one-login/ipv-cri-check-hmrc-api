import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import { clearItems, populateTable } from "../resources/dynamodb-helper";
import {
  getSSMParamter,
  ssmParamterUpdate,
} from "../resources/ssm-param-helper";
import {
  getSecretParamValue,
  secretManagerUpdate,
} from "../resources/secret-manager-helper";

jest.setTimeout(30_000);

describe("nino-check-unhappy", () => {
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

  let sessionTableName: string;
  let personIdentityTableName: string;

  let output: Partial<{
    CommonStackName: string;
    NinoAttemptsTable: string;
    NinoUsersTable: string;
    NinoCheckStateMachineArn: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;

    await populateTable(
      {
        sessionId: input.sessionId,
        expiryDate: 9999999999,
      },
      sessionTableName
    );

    await populateTable(
      {
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
      personIdentityTableName
    );
  });

  afterEach(async () => {
    await clearItems(sessionTableName, {
      sessionId: input.sessionId,
    });
    await clearItems(personIdentityTableName, {
      sessionId: input.sessionId,
    });
    await clearItems(output.NinoAttemptsTable as string, {
      id: input.sessionId,
    });
    await clearItems(output.NinoUsersTable as string, {
      sessionId: input.sessionId,
    });
  });

  it("should fail when there is more than 2 nino check attempts", async () => {
    await populateTable(
      {
        id: input.sessionId,
        attempts: 2,
      },
      output.NinoAttemptsTable
    );

    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
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
      input,
      output.NinoCheckStateMachineArn
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
      input,
      output.NinoCheckStateMachineArn
    );
    expect(startExecutionResult.output).toBe(
      '{"error":"Session is not valid or has expired"}'
    );
    expect(startExecutionResult.status).toBe("SUCCEEDED");
  });

  it("should fail when user record already present in nino user table", async () => {
    await populateTable(
      {
        sessionId: "123456789",
        nino: "AA000003D",
      },
      output.NinoUsersTable
    );
    const startExecutionResult = await executeStepFunction(
      {
        sessionId: "123456789",
        nino: "AA000003D",
      },
      output.NinoCheckStateMachineArn
    );

    expect(startExecutionResult.status).toBe("FAILED");
  });

  it("should fail when user nino does not match with HMRC DB", async () => {
    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );
    expect(startExecutionResult.output).toBe(
      '{"error":"CID returned no record"}'
    );
  });

  it("should throw an error when url is unavailable", async () => {
    const urlParameterName = `/${process.env.STACK_NAME}/NinoCheckUrl`;

    const currentURL = (
      await getSSMParamter({
        Name: urlParameterName,
      })
    ).Parameter?.Value as string;

    await ssmParamterUpdate({
      Name: urlParameterName,
      Value: "bad-url",
      Type: "String",
      Overwrite: true,
    });

    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );

    await ssmParamterUpdate({
      Name: urlParameterName,
      Value: currentURL,
      Type: "String",
      Overwrite: true,
    });

    expect(startExecutionResult.status).toEqual("FAILED");
  });
  it("should throw an error when token is invalid", async () => {
    const currentValue = (
      await getSecretParamValue({
        SecretId: "HMRCBearerToken",
      })
    ).SecretString;

    await secretManagerUpdate({
      SecretId: "HMRCBearerToken",
      SecretString: "badToken",
    });

    const startExecutionResult = await executeStepFunction(
      input,
      output.NinoCheckStateMachineArn
    );

    await secretManagerUpdate({
      SecretId: "HMRCBearerToken",
      SecretString: currentValue,
    });

    expect(startExecutionResult.status).toEqual("FAILED");
  });
});
