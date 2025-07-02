import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { removeAuthCodeFromSessionRecord, retrieveSessionRecord } from "../../src/services/abandon-dynamo-service";
import { CriError } from "../../../common/src/errors/cri-error";

describe("abandon-dynamo-service", () => {
  const ddbMock = mockClient(DynamoDBClient);
  const now = Math.round(Date.now() / 1000);
  const anHourFromNow = now + 60 * 60;

  describe("retrieveSessionRecord", () => {
    beforeEach(() => {
      ddbMock.reset();
    });

    it("should successfully return a SessionItem", async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            sessionId: { S: "session-123" },
            clientSessionId: { S: "gov-123" },
            expiryDate: { N: anHourFromNow.toString() },
          },
        ],
        Count: 1,
      });

      const sessionItem = await retrieveSessionRecord("session-table", "session-123");
      expect(sessionItem.sessionId).toBe("session-123");
      expect(sessionItem.clientSessionId).toBe("gov-123");
      expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
        ExpressionAttributeValues: {
          ":value": { S: "session-123" },
        },
        KeyConditionExpression: "sessionId = :value",
        TableName: "session-table",
      });
    });

    it("should throw when Session not found", async () => {
      expect.assertions(3);

      ddbMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0,
      });

      try {
        await retrieveSessionRecord("session-table", "session-123");
      } catch (err) {
        expect(err).toBeInstanceOf(CriError);
        expect((err as CriError).message).toBe("Session not found");
        expect((err as CriError).status).toBe(400);
      }
    });

    it("should throw when Session expired", async () => {
      expect.assertions(3);

      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            sessionId: { S: "session-123" },
            expiryDate: { N: "1" },
          },
        ],
        Count: 1,
      });

      try {
        await retrieveSessionRecord("session-table", "session-123");
      } catch (err) {
        expect(err).toBeInstanceOf(CriError);
        expect((err as CriError).message).toBe("Session expired");
        expect((err as CriError).status).toBe(400);
      }
    });

    it("should throw an exception when it errors retrievings a record", async () => {
      ddbMock.on(QueryCommand).rejects();

      await expect(retrieveSessionRecord("session-table", "session-123")).rejects.toThrow(Error);
    });
  });

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
