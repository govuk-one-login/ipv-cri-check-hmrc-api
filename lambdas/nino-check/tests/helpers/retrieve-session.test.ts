import { RecordExpiredError, RecordNotFoundError } from "../../../common/src/database/exceptions/errors";
import * as getRecordModule from "../../../common/src/database/get-record-by-session-id";
import { logger } from "../../../common/src/util/logger";
import { captureMetric } from "../../../common/src/util/metrics";
import { retrieveSession } from "../../src/helpers/retrieve-session";
import { mockDynamoClient } from "../mocks/mockDynamoClient";
import { mockSession, mockSessionId } from "../mocks/mockData";
jest.mock("../../../common/src/util/logger");
jest.mock("../../../common/src/util/metrics");

const getRecordBySessionId = jest.spyOn(getRecordModule, "getRecordBySessionId");
getRecordBySessionId.mockResolvedValue([mockSession]);

const sessionTableName = "my-session-zone";

describe("retrieveSession()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns as expected for some valid input", async () => {
    const result = await retrieveSession(sessionTableName, mockDynamoClient, mockSessionId);

    expect(result).toEqual(mockSession);
  });

  it("handles expired record(s) correctly", async () => {
    getRecordBySessionId.mockImplementationOnce(() => {
      throw new RecordExpiredError(sessionTableName, mockSessionId, [42]);
    });

    let thrown = false;

    try {
      await retrieveSession(sessionTableName, mockDynamoClient, mockSessionId);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 400 }));
    }

    expect(thrown).toEqual(true);
    expect(captureMetric).toHaveBeenCalledWith("InvalidSessionErrorMetric");
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("42"));
  });

  it("handles a missing record correctly", async () => {
    getRecordBySessionId.mockImplementationOnce(() => {
      throw new RecordNotFoundError(sessionTableName, mockSessionId);
    });

    let thrown = false;

    try {
      await retrieveSession(sessionTableName, mockDynamoClient, mockSessionId);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 400 }));
    }

    expect(thrown).toEqual(true);
    expect(captureMetric).toHaveBeenCalledWith("InvalidSessionErrorMetric");
  });

  it("handles an unrecognised error correctly", async () => {
    getRecordBySessionId.mockImplementationOnce(() => {
      throw new Error("illegal");
    });

    let thrown = false;

    try {
      await retrieveSession(sessionTableName, mockDynamoClient, mockSessionId);
    } catch (error) {
      thrown = true;
      expect(error).toEqual(expect.objectContaining({ name: "CriError", status: 400 }));
    }

    expect(thrown).toEqual(true);
    expect(captureMetric).toHaveBeenCalledWith("InvalidSessionErrorMetric");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });
});
