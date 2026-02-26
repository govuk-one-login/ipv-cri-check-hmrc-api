import { mockLogger } from "../../../common/tests/logger";
jest.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { removeAuthCodeFromSessionRecord } from "../../src/services/abandon-dynamo-service";

describe("abandon-dynamo-service", () => {
  const ddbMock = mockClient(DynamoDBClient);

  describe("removeAuthCodeFromSessionRecord", () => {
    beforeEach(() => {
      ddbMock.reset();
    });

    it("should successfully update the record", async () => {
      ddbMock.on(UpdateItemCommand).resolves({});

      await expect(removeAuthCodeFromSessionRecord("session-table", "session-123")).resolves.not.toThrow(Error);
      expect(ddbMock).toHaveReceivedCommandWith(UpdateItemCommand, {
        ExpressionAttributeValues: { ":expiry": { N: "0" } },
        Key: { sessionId: { S: "session-123" } },
        TableName: "session-table",
        UpdateExpression: "SET authorizationCodeExpiryDate = :expiry REMOVE authorizationCode",
      });
    });

    it("should throw an error if it is unable to update the record", async () => {
      ddbMock.on(UpdateItemCommand).rejects();

      await expect(removeAuthCodeFromSessionRecord("session-table", "session-123")).rejects.toThrow(Error);
    });
  });
});
