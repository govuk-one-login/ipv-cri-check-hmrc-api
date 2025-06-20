import { mockLogger } from "../../../common/tests/logger";
import { issueAuthorizationCode } from "../../src/steps/3-issue-authorization-code";
import { mockDynamoClient, mockHelpers, mockTableNames } from "./mockConfig";
import { mockNino, mockSessionId } from "./mockRecords";
import * as updateModule from "../../../common/src/database/update-record-by-session-id";
import * as insertModule from "../../../common/src/database/insert-record";

const updateRecordBySessionId = jest.spyOn(updateModule, "updateRecordBySessionId");
const insertRecord = jest.spyOn(insertModule, "insertRecord");

const mockPutObjectRes = {
  Attributes: {},
  ConsumedCapacity: {},
  ItemCollectionMetrics: {},
  $metadata: {
    httpStatusCode: 201,
  },
};

describe("NINo Check function issueAuthorizationCode()", () => {
  it(`saves entities to Dynamo as expected`, async () => {
    updateRecordBySessionId.mockResolvedValue(mockPutObjectRes);
    insertRecord.mockResolvedValue(mockPutObjectRes);

    await issueAuthorizationCode(mockTableNames, mockHelpers, mockSessionId, mockNino);

    expect(updateRecordBySessionId).toHaveBeenCalledWith(
      mockTableNames.sessionTable,
      {
        sessionId: mockSessionId,
        authorizationCode: expect.stringMatching(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        ),
        authorizationCodeExpiryDate: expect.any(Number),
      },
      mockLogger,
      mockDynamoClient
    );

    expect(insertRecord).toHaveBeenCalledWith(
      mockTableNames.ninoUserTable,
      {
        sessionId: mockSessionId,
        nino: mockNino,
      },
      mockLogger,
      mockDynamoClient
    );
  });
});
