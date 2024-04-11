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
  deleteSSMParameter,
  updateSSMParameter,
} from "../resources/ssm-param-helper";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

jest.setTimeout(30_000);

describe("nino-check-unhappy", () => {
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
    UserAttemptsTable: string;
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
          clientId: "ipv-core-stub-aws-prod",
          clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
          persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
          subject: "test",
          clientIpAddress: "00.100.8.20",
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
    await clearAttemptsTable(input.sessionId, output.UserAttemptsTable);
  });

  it("should fail when there is more than 2 nino check attempts", async () => {
    await populateTable(output.UserAttemptsTable as string, {
      sessionId: input.sessionId,
      timestamp: Date.now().toString(),
    });

    await populateTable(output.UserAttemptsTable as string, {
      sessionId: input.sessionId,
      timestamp: Date.now().toString(),
    });

    const startExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"httpStatus":200}');
  });

  it("should fail when there is no user present for given nino", async () => {
    await clearItems(personIdentityTableName, {
      sessionId: input.sessionId,
    });

    const startExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"httpStatus":500}');
  });

  it("should fail when session id is invalid", async () => {
    await clearItems(sessionTableName, {
      sessionId: input.sessionId,
    });

    const startExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      input
    );

    expect(startExecutionResult.output).toBe('{"httpStatus":400}');
    expect(startExecutionResult.status).toBe("SUCCEEDED");
  });

  it("should fail when user is deceased", async () => {
    const inputDeceased = {
      sessionId: "check-unhappy",
      nino: "AA000003C",
    };

    const testDeceasedUser = {
      nino: inputDeceased.nino,
      dob: "1948-04-23",
      firstName: "Error",
      lastName: "Deceased",
    };

    await populateTables({
      tableName: personIdentityTableName,
      items: {
        sessionId: inputDeceased.sessionId,
        nino: inputDeceased.nino,
        birthDates: [{ value: testDeceasedUser.dob }],
        names: [
          {
            nameParts: [
              {
                type: "GivenName",
                value: testDeceasedUser.firstName,
              },
              {
                type: "FamilyName",
                value: testDeceasedUser.lastName,
              },
            ],
          },
        ],
      },
    });

    const startExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      inputDeceased
    );

    expect(startExecutionResult.output).toBe('{"httpStatus":422}');
  });

  it("should fail when user NINO does not match with HMRC DB", async () => {
    const inputNoCidNinoUser = {
      sessionId: "check-unhappy",
      nino: "AA000003C",
    };

    const testNoCidNinoUser = {
      nino: inputNoCidNinoUser.nino,
      dob: "1948-04-23",
      firstName: "Error",
      lastName: "NoCidForNino",
    };

    await populateTables({
      tableName: personIdentityTableName,
      items: {
        sessionId: inputNoCidNinoUser.sessionId,
        nino: inputNoCidNinoUser.nino,
        birthDates: [{ value: testNoCidNinoUser.dob }],
        names: [
          {
            nameParts: [
              {
                type: "GivenName",
                value: testNoCidNinoUser.firstName,
              },
              {
                type: "FamilyName",
                value: testNoCidNinoUser.lastName,
              },
            ],
          },
        ],
      },
    });

    const startExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      inputNoCidNinoUser
    );

    expect(startExecutionResult.output).toBe('{"httpStatus":422}');
  });

  describe("NINO check URL is unavailable", () => {
    const mockNino2 = "AB123003D";
    const mockClientId2 = `${process.env.STACK_NAME}-IntegrationTest`;
    const mockInput2 = {
      sessionId: "check-unhappy2",
      nino: mockNino2,
    };
    const mockUser2 = {
      nino: mockNino2,
      dob: "1948-04-23",
      firstName: "Tony",
      lastName: "Jones",
    };

    const mockThirdPartyUrlSSM = `/check-hmrc-cri-api/NinoCheckUrl/${mockClientId2}`;

    beforeAll(async () => {
      await populateTables(
        {
          tableName: sessionTableName,
          items: {
            sessionId: mockInput2.sessionId,
            expiryDate: 9999999999,
            clientId: mockClientId2,
          },
        },
        {
          tableName: personIdentityTableName,
          items: {
            sessionId: mockInput2.sessionId,
            nino: mockInput2.nino,
            birthDates: [{ value: mockUser2.dob }],
            names: [
              {
                nameParts: [
                  {
                    type: "GivenName",
                    value: mockUser2.firstName,
                  },
                  {
                    type: "FamilyName",
                    value: mockUser2.lastName,
                  },
                ],
              },
            ],
          },
        }
      );
    });

    afterAll(async () => {
      await deleteSSMParameter(mockThirdPartyUrlSSM);
      await clearItemsFromTables(
        {
          tableName: sessionTableName,
          items: { sessionId: mockInput2.sessionId },
        },
        {
          tableName: personIdentityTableName,
          items: { sessionId: mockInput2.sessionId },
        },
        {
          tableName: output.NinoUsersTable as string,
          items: { sessionId: mockInput2.sessionId },
        }
      );
      await clearAttemptsTable(mockInput2.sessionId, output.UserAttemptsTable);
    });

    it("should throw an error when parameter for url is missing", async () => {
      const startExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        mockInput2
      );

      expect(startExecutionResult.status).toEqual("FAILED");
    });

    it("should throw an error when parameter contains an invalid url", async () => {
      await updateSSMParameter(mockThirdPartyUrlSSM, "bad-url");

      const startExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        mockInput2
      );
      expect(startExecutionResult.status).toEqual("FAILED");
    });
  });
});
