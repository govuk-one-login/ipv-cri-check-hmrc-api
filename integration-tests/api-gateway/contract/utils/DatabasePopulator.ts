import { clearAttemptsTable, clearItemsFromTables, populateTables } from "../../../resources/dynamodb-helper";
import { testUser } from "../../user";

type EvidenceRequest = {
  scoringPolicy: string;
  strengthScore: number;
};

export const populateDatabaseForContractTests = async () => {
  await ninoCheckPassedData(
    {
      sessionId: "contract-issue-credential-passed",
      nino: "AA000003D",
    },
    "Bearer issue-credential-passed"
  );

  await ninoCheckPassedData(
    {
      sessionId: "contract-issue-credential-identity-passed",
      nino: "AA000003D",
    },
    "Bearer issue-credential-identity-passed",
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
    "Bearer issue-credential-failed"
  );

  await ninoCheckFailedData(
    {
      sessionId: "contract-issue-credential-identity-failed",
      nino: "AA000003D",
    },
    "Bearer issue-credential-identity-failed",
    {
      scoringPolicy: "gpg45",
      strengthScore: 2,
    }
  );
};

export const clearContractTestsFromDatabase = async () => {
  await clearData("contract-issue-credential-passed");
  await clearData("contract-issue-credential-identity-passed");
  await clearData("contract-issue-credential-failed");
  await clearData("contract-issue-credential-identity-failed");
};

const expiryDate = 9999999999;

const ninoCheckPassedData = async (
  input: {
    sessionId: string;
    nino: string;
  },
  bearerToken: string,
  evidenceRequested?: EvidenceRequest
) => {
  await populateTables(
    {
      tableName: `${process.env.NINO_USERS_TABLE}`,
      items: {
        ttl: expiryDate,
        sessionId: input.sessionId,
        nino: input.nino,
      },
    },
    {
      tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
      items: {
        sessionId: input.sessionId,
        expiryDate,
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
      tableName: `${process.env.SESSION_TABLE}`,
      items: getSessionItem(input, bearerToken, evidenceRequested),
    },
    {
      tableName: `${process.env.USERS_ATTEMPTS_TABLE}`,
      items: {
        sessionId: input.sessionId,
        ttl: expiryDate,
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
  evidenceRequested?: EvidenceRequest
) => {
  await populateTables(
    {
      tableName: `${process.env.NINO_USERS_TABLE}`,
      items: {
        ttl: expiryDate,
        sessionId: input.sessionId,
        nino: input.nino,
      },
    },
    {
      tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
      items: {
        sessionId: input.sessionId,
        expiryDate,
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
      tableName: `${process.env.SESSION_TABLE}`,
      items: getSessionItem(input, bearerToken, evidenceRequested),
    },
    {
      tableName: `${process.env.USERS_ATTEMPTS_TABLE}`,
      items: {
        sessionId: input.sessionId,
        ttl: expiryDate,
        timestamp: Date.now().toString() + 1,
        attempt: "FAIL",
        status: 200,
        text: "DOB does not match CID, First Name does not match CID",
      },
    },
    {
      tableName: `${process.env.USERS_ATTEMPTS_TABLE}`,
      items: {
        sessionId: input.sessionId,
        ttl: expiryDate,
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
  expiryDate,
  subject: "test",
  clientId: "exampleClientId",
  clientIpAddress: "00.100.8.20",
  clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
  persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
  evidenceRequest,
  txn: "dummyTxn",
});

const clearData = async (sessionId: string) => {
  await clearItemsFromTables(
    {
      tableName: `${process.env.SESSION_TABLE}`,
      items: { sessionId },
    },
    {
      tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
      items: { sessionId },
    },
    {
      tableName: `${process.env.NINO_USERS_TABLE}`,
      items: { sessionId },
    }
  );
  await clearAttemptsTable(sessionId, `${process.env.USERS_ATTEMPTS_TABLE}`);
};
