import * as getRecordModule from "../../../common/src/database/get-record-by-session-id";
import { logger } from "../../../common/src/util/logger";
import { retrieveAttempts } from "../../src/helpers/retrieve-attempts";
import { mockDynamoClient } from "../mocks/mockDynamoClient";
import { mockAttempt, mockSessionId } from "../mocks/mockData";
jest.mock("../../../common/src/util/logger");
jest.mock("../../../common/src/util/metrics");

const getRecordBySessionId = jest.spyOn(getRecordModule, "getRecordBySessionId");

const attemptTableName = "attempt-club";

describe("retrieveAttempts()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the attempt count correctly", async () => {
    getRecordBySessionId.mockResolvedValue([]);

    const count0 = await retrieveAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(getRecordBySessionId).toHaveBeenCalledWith(
      attemptTableName,
      mockSessionId,
      logger,
      { allowNoEntries: true, allowMultipleEntries: true },
      mockDynamoClient
    );

    expect(count0).toEqual(0);

    getRecordBySessionId.mockReset();

    getRecordBySessionId.mockResolvedValue([mockAttempt]);

    const count1 = await retrieveAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(getRecordBySessionId).toHaveBeenCalledWith(
      attemptTableName,
      mockSessionId,
      logger,
      { allowNoEntries: true, allowMultipleEntries: true },
      mockDynamoClient
    );

    expect(count1).toEqual(1);

    getRecordBySessionId.mockReset();

    getRecordBySessionId.mockResolvedValue([mockAttempt, mockAttempt]);

    const count2 = await retrieveAttempts(attemptTableName, mockDynamoClient, mockSessionId);

    expect(getRecordBySessionId).toHaveBeenCalledWith(
      attemptTableName,
      mockSessionId,
      logger,
      { allowNoEntries: true, allowMultipleEntries: true },
      mockDynamoClient
    );

    expect(count2).toEqual(2);
  });
});
