import * as getRecordModule from "../../../common/src/database/get-record-by-session-id";
import { TooManyAttemptsError } from "../../src/exceptions/errors";
import { getSessionInfo } from "../../src/helpers/get-session-info";
import { TableNames } from "../../src/types/input";
import { mockHelpers } from "../mocks/mockConfig";
import { mockAttempt, mockPersonIdentity, mockSession, mockSessionId } from "../mocks/mockRecords";

const getRecordBySessionId = jest.spyOn(getRecordModule, "getRecordBySessionId");

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

  it("throws an error if the user has already attempted the check twice", async () => {
    getRecordBySessionId.mockResolvedValueOnce([mockSession]).mockResolvedValueOnce([mockAttempt, mockAttempt]);

    await expect(async () => getSessionInfo(tableNames, mockHelpers, mockSessionId)).rejects.toThrow(
      TooManyAttemptsError
    );
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
