import { executeStepFunction } from "../../../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItems,
  clearItemsFromTables,
  populateTable,
  populateTables,
} from "../../../resources/dynamodb-helper";
import {
  deleteSSMParameter,
  updateSSMParameter,
} from "../../../resources/ssm-param-helper";

jest.setTimeout(30_000);

describe("nino-check-unhappy", () => {
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

  let userAttemptsTable: string;
  let ninoUsersTable: string;
  let ninoCheckStateMachineArn: string;
  let sessionTableName: string;
  let personIdentityTableName: string;

  beforeEach(async () => {
    sessionTableName = `${process.env.SESSION_TABLE}`;
    personIdentityTableName = `${process.env.PERSON_IDENTITY_TABLE}`;
    userAttemptsTable = `${process.env.USERS_ATTEMPTS_TABLE}`;
    ninoUsersTable = `${process.env.NINO_USERS_TABLE}`;
    ninoCheckStateMachineArn = `${process.env.NINO_CHECK_STATE_MACHINE_ARN}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    personIdentityTableName = `${process.env.PERSON_IDENTITY_TABLE}`;

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
        tableName: ninoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );
    await clearAttemptsTable(input.sessionId, userAttemptsTable);
  });

  it("should fail when there is more than 2 nino check attempts", async () => {
    await populateTable(userAttemptsTable, {
      sessionId: input.sessionId,
      timestamp: Date.now().toString(),
    });

    await populateTable(userAttemptsTable, {
      sessionId: input.sessionId,
      timestamp: Date.now().toString(),
    });

    const startExecutionResult = await executeStepFunction(
      ninoCheckStateMachineArn,
      input
    );

    expect(JSON.parse(startExecutionResult.output || "")).toStrictEqual({
      httpStatus: 200,
      body: '{"requestRetry":false}',
    });
  });

  it("should fail when there is no user present for given nino", async () => {
    await clearItems(personIdentityTableName, {
      sessionId: input.sessionId,
    });

    const startExecutionResult = await executeStepFunction(
      ninoCheckStateMachineArn,
      input
    );

    expect(startExecutionResult.output).toBe('{"httpStatus":500}');
  });

  it("should fail when session id is invalid", async () => {
    await clearItems(sessionTableName, {
      sessionId: input.sessionId,
    });

    const startExecutionResult = await executeStepFunction(
      ninoCheckStateMachineArn,
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
      ninoCheckStateMachineArn,
      inputDeceased
    );

    expect(JSON.parse(startExecutionResult.output || "")).toStrictEqual({
      httpStatus: 200,
      body: '{"requestRetry":true}',
    });
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
      ninoCheckStateMachineArn,
      inputNoCidNinoUser
    );

    expect(startExecutionResult.output).toBe(
      '{"httpStatus":200,"body":"{\\"requestRetry\\":true}"}'
    );
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
            subject: "test",
            clientIpAddress: "00.100.8.20",
            clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
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
          tableName: ninoUsersTable,
          items: { sessionId: mockInput2.sessionId },
        }
      );
      await clearAttemptsTable(mockInput2.sessionId, userAttemptsTable);
    });

    it("should throw an error when parameter for url is missing", async () => {
      const startExecutionResult = await executeStepFunction(
        ninoCheckStateMachineArn,
        mockInput2
      );

      expect(startExecutionResult.status).toEqual("FAILED");
    });

    it("should throw an error when parameter contains an invalid url", async () => {
      await updateSSMParameter(mockThirdPartyUrlSSM, "bad-url");

      const startExecutionResult = await executeStepFunction(
        ninoCheckStateMachineArn,
        mockInput2
      );
      expect(startExecutionResult.status).toEqual("FAILED");
    });
  });
});
