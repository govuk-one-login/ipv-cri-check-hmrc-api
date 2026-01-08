import { mockLogger } from "../../../common/tests/logger";
jest.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
import { RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import * as getRecordModule from "../../../common/src/database/get-record-by-session-id";
import { logger } from "@govuk-one-login/cri-logger";
import { mockDynamoClient } from "../../../common/tests/mocks/mockDynamoClient";
import { mockNinoUser, mockSessionId } from "../../../common/tests/mocks/mockData";
import { retrieveNinoUser } from "../../src/helpers/retrieve-nino-user";
jest.mock("../../../common/src/util/metrics");

const getRecordBySessionId = jest.spyOn(getRecordModule, "getRecordBySessionId");
getRecordBySessionId.mockResolvedValue(mockNinoUser);

const ninoUserTableName = "nino-user-squad";

describe("retrieveNinoUser()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns as expected for some valid input", async () => {
    const result = await retrieveNinoUser(ninoUserTableName, mockDynamoClient, mockSessionId);

    expect(result).toEqual(mockNinoUser);
  });

  it("handles a missing record correctly", async () => {
    getRecordBySessionId.mockImplementationOnce(() => {
      throw new RecordNotFoundError(ninoUserTableName, mockSessionId);
    });

    let thrown = false;

    try {
      await retrieveNinoUser(ninoUserTableName, mockDynamoClient, mockSessionId);
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
      await retrieveNinoUser(ninoUserTableName, mockDynamoClient, mockSessionId);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 500 }));
    }

    expect(thrown).toEqual(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });
});
