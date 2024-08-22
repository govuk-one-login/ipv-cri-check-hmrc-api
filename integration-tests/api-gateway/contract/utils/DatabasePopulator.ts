import { stackOutputs } from "../../../resources/cloudformation-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  populateTables,
} from "../../../resources/dynamodb-helper";

type EvidenceRequest = {
  scoringPolicy: string;
  strengthScore: number;
};

type StackOutput = Partial<{
  CommonStackName: string;
  StackName: string;
  NinoUsersTable: string;
  UserAttemptsTable: string;
}>;

const testUser = {
  nino: "AA000003D",
  dob: "1965-07-08",
  firstName: "Kenneth",
  lastName: "Decerqueira",
};

export const populateDatabaseForContractTests = async () => {
  const stackOutput: StackOutput = await stackOutputs(process.env.STACK_NAME);

  await ninoCheckPassedData(
    {
      sessionId: "contract-issue-credential-passed",
      nino: "AA000003D",
    },
    "Bearer issue-credential-passed",
    stackOutput
  );

  await ninoCheckPassedData(
    {
      sessionId: "contract-issue-credential-identity-passed",
      nino: "AA000003D",
    },
    "Bearer issue-credential-identity-passed",
    stackOutput,
    {
      scoringPolicy: "gpg45",
      strengthScore: 2,
    }
  );

  await ninoCheckFailedData(
    {
      sessionId: "contract-issue-credential-failed",
      nino: "AA000003D",
    },
    "Bearer issue-credential-failed",
    stackOutput
  );

  await ninoCheckFailedData(
    {
      sessionId: "contract-issue-credential-identity-failed",
      nino: "AA000003D",
    },
    "Bearer issue-credential-identity-failed",
    stackOutput,
    {
      scoringPolicy: "gpg45",
      strengthScore: 2,
    }
  );
};

export const clearContractTestsFromDatabase = async () => {
  const stackOutput: StackOutput = await stackOutputs(process.env.STACK_NAME);
  await clearData("contract-issue-credential-passed", stackOutput);
  await clearData("contract-issue-credential-identity-passed", stackOutput);
  await clearData("contract-issue-credential-failed", stackOutput);
  await clearData("contract-issue-credential-identity-failed", stackOutput);
};

const ninoCheckPassedData = async (
  input: {
    sessionId: string;
    nino: string;
  },
  bearerToken: string,
  stackOutput: StackOutput,
  evidenceRequested?: EvidenceRequest
) => {
  await populateTables(
    {
      tableName: `${stackOutput.NinoUsersTable}`,
      items: {
        sessionId: input.sessionId,
        nino: input.nino,
      },
    },
    {
      tableName: `person-identity-${stackOutput.CommonStackName}`,
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
    },
    {
      tableName: `session-${stackOutput.CommonStackName}`,
      items: getSessionItem(input, bearerToken, evidenceRequested),
    },
    {
      tableName: `${stackOutput.UserAttemptsTable}`,
      items: {
        sessionId: input.sessionId,
        timestamp: Date.now().toString(),
        attempts: 1,
        outcome: "PASS",
      },
    }
  );
};

const ninoCheckFailedData = async (
  input: {
    sessionId: string;
    nino: string;
  },
  bearerToken: string,
  stackOutput: StackOutput,
  evidenceRequested?: EvidenceRequest
) => {
  await populateTables(
    {
      tableName: `${stackOutput.NinoUsersTable}`,
      items: {
        sessionId: input.sessionId,
        nino: input.nino,
      },
    },
    {
      tableName: `person-identity-${stackOutput.CommonStackName}`,
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
    },
    {
      tableName: `session-${stackOutput.CommonStackName}`,
      items: getSessionItem(input, bearerToken, evidenceRequested),
    },
    {
      tableName: `${stackOutput.UserAttemptsTable}`,
      items: {
        sessionId: input.sessionId,
        timestamp: Date.now().toString() + 1,
        attempt: "FAIL",
        status: 200,
        text: "DOB does not match CID, First Name does not match CID",
      },
    },
    {
      tableName: `${stackOutput.UserAttemptsTable}`,
      items: {
        sessionId: input.sessionId,
        timestamp: Date.now().toString(),
        attempt: "FAIL",
        status: 200,
        text: "DOB does not match CID, First Name does not match CID",
      },
    }
  );
};

const getSessionItem = (
  input: {
    sessionId: string;
    nino: string;
  },
  accessToken: string,
  evidenceRequest?: EvidenceRequest
): {
  [x: string]: unknown;
} => ({
  sessionId: input.sessionId,
  accessToken: accessToken,
  authorizationCode: "cd8ff974-d3bc-4422-9b38-a3e5eb24adc0",
  authorizationCodeExpiryDate: "1698925598",
  expiryDate: "9999999999",
  subject: "test",
  clientId: "exampleClientId",
  clientIpAddress: "00.100.8.20",
  clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
  persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
  evidenceRequest,
  txn: "dummyTxn",
});

const clearData = async (sessionId: string, stackOutput: StackOutput) => {
  await clearItemsFromTables(
    {
      tableName: `session-${stackOutput.CommonStackName}`,
      items: { sessionId },
    },
    {
      tableName: `person-identity-${stackOutput.CommonStackName}`,
      items: { sessionId },
    },
    {
      tableName: `${stackOutput.NinoUsersTable}`,
      items: { sessionId },
    }
  );
  await clearAttemptsTable(sessionId, `${stackOutput.UserAttemptsTable}`);
};
