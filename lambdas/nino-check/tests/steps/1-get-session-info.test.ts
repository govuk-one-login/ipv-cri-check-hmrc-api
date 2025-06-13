import { TooManyRecordsError } from "../../../common/src/database/exceptions/errors";
import * as getRecordModule from "../../../common/src/database/get-record-by-session-id";
import { TooManyAttemptsError } from "../../src/exceptions/errors";
import { getSessionInfo } from "../../src/steps/1-get-session-info";
import { TableNames } from "../../src/types/input";
import { mockHelpers } from "./mockConfig";
import {
  mockAttempt,
  mockPersonIdentity,
  mockSession,
  mockSessionId,
} from "./mockRecords";

const getRecordBySessionId = jest.spyOn(
  getRecordModule,
  "getRecordBySessionId"
);

const tableNames: TableNames = {
  sessionTable: "my-session-zone",
  personIdentityTable: "person-identity-hangout",
  attemptTable: "attempt-gang",
  ninoUserTable: "nino-user-area",
};

describe("NINo Check function getSessionInfo()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns as expected for some valid input", async () => {
    getRecordBySessionId
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([
        /* no attempts */
      ])
      .mockResolvedValueOnce([mockPersonIdentity]);

    const result = await getSessionInfo(tableNames, mockHelpers, mockSessionId);

    expect(result).toEqual({
      session: mockSession,
      personIdentity: mockPersonIdentity,
      isFinalAttempt: false,
    });
  });

  it("throws an error if more than one session is returned", async () => {
    getRecordBySessionId.mockResolvedValueOnce([mockSession, mockSession]);

    await expect(async () =>
      getSessionInfo(tableNames, mockHelpers, mockSessionId)
    ).rejects.toThrow(TooManyRecordsError);
  });

  it("throws an error if the user has already attempted the check twice", async () => {
    getRecordBySessionId
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([mockAttempt, mockAttempt]);

    await expect(async () =>
      getSessionInfo(tableNames, mockHelpers, mockSessionId)
    ).rejects.toThrow(TooManyAttemptsError);
  });

  it("throws an error if more than one person identity is returned", async () => {
    getRecordBySessionId
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockPersonIdentity, mockPersonIdentity]);

    await expect(async () =>
      getSessionInfo(tableNames, mockHelpers, mockSessionId)
    ).rejects.toThrow(TooManyRecordsError);
  });

  it("sets isFinalAttempt to true when the session has already had one attempt", async () => {
    getRecordBySessionId
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([mockAttempt])
      .mockResolvedValueOnce([mockPersonIdentity]);

    const result = await getSessionInfo(tableNames, mockHelpers, mockSessionId);

    expect(result).toEqual({
      session: mockSession,
      personIdentity: mockPersonIdentity,
      isFinalAttempt: true,
    });
  });
});
