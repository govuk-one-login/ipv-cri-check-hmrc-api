import { RecordExpiredError, RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import * as getRecordModule from "../../../common/src/database/get-record-by-session-id";
import { logger } from "../../../common/src/util/logger";
import { retrievePersonIdentity } from "../../src/helpers/retrieve-person-identity";
import { mockDynamoClient } from "../mocks/mockDynamoClient";
import { mockPersonIdentity, mockSessionId } from "../mocks/mockData";
jest.mock("../../../common/src/util/logger");
jest.mock("../../../common/src/util/metrics");

const getRecordBySessionId = jest.spyOn(getRecordModule, "getRecordBySessionId");
getRecordBySessionId.mockResolvedValue([mockPersonIdentity]);

const personIdentityTableName = "person-identity-gang";

describe("retrievePersonIdentity()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns as expected for some valid input", async () => {
    const result = await retrievePersonIdentity(personIdentityTableName, mockDynamoClient, mockSessionId);

    expect(result).toEqual(mockPersonIdentity);
  });

  it("handles expired record(s) correctly", async () => {
    getRecordBySessionId.mockImplementationOnce(() => {
      throw new RecordExpiredError(personIdentityTableName, mockSessionId, [42]);
    });

    let thrown = false;

    try {
      await retrievePersonIdentity(personIdentityTableName, mockDynamoClient, mockSessionId);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("42"));
  });

  it("handles a missing record correctly", async () => {
    getRecordBySessionId.mockImplementationOnce(() => {
      throw new RecordNotFoundError(personIdentityTableName, mockSessionId);
    });

    let thrown = false;

    try {
      await retrievePersonIdentity(personIdentityTableName, mockDynamoClient, mockSessionId);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
  });

  it("handles an unrecognised error correctly", async () => {
    getRecordBySessionId.mockImplementationOnce(() => {
      throw new Error("illegal");
    });

    let thrown = false;

    try {
      await retrievePersonIdentity(personIdentityTableName, mockDynamoClient, mockSessionId);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });
});
