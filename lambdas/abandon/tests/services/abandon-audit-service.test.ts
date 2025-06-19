import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { SessionItem } from "../../../common/src/database/types/session-item";
import { createUserAuditInfo, sendAuditEvent } from "../../src/services/abandon-audit-service";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { AbandonHandlerConfig } from "../../src/config/abandon-handler-config";
import { CriError } from "../../../common/src/errors/cri-error";

describe("abandon-audit-service", () => {
  describe("createUserAuditInfo", () => {
    it("should successfully create user info for audit event", () => {
      const expectedUserInfo = {
        govuk_signin_journey_id: "abc123",
        ip_address: "192.0.0.1",
        session_id: "session-id",
        user_id: "user-id",
        persistent_session_id: "persisent-id",
      };

      const sessionItem: SessionItem = {
        expiryDate: 0,
        sessionId: "session-id",
        clientId: "dummy",
        clientSessionId: "abc123",
        authorizationCodeExpiryDate: 0,
        redirectUri: "dummy",
        accessToken: "dummy",
        accessTokenExpiryDate: 0,
        clientIpAddress: "192.0.0.1",
        subject: "user-id",
        persistentSessionId: "persisent-id",
      };

      const userInfo = createUserAuditInfo(sessionItem);

      expect(userInfo).toStrictEqual(expectedUserInfo);
    });

    it("should successfully create user info for audit event without persistent session ID", () => {
      const expectedUserInfo = {
        govuk_signin_journey_id: "abc123",
        ip_address: "192.0.0.1",
        session_id: "session-id",
        user_id: "user-id",
      };

      const sessionItem: SessionItem = {
        expiryDate: 0,
        sessionId: "session-id",
        clientId: "dummy",
        clientSessionId: "abc123",
        authorizationCodeExpiryDate: 0,
        redirectUri: "dummy",
        accessToken: "dummy",
        accessTokenExpiryDate: 0,
        clientIpAddress: "192.0.0.1",
        subject: "user-id",
      };

      const userInfo = createUserAuditInfo(sessionItem);

      expect(userInfo).toStrictEqual(expectedUserInfo);
    });

    it("should create a user info object with undefined values and not throw an error", () => {
      const expectedUserInfo = {
        govuk_signin_journey_id: undefined,
        ip_address: undefined,
        session_id: undefined,
        user_id: undefined,
      };

      const sessionItem = {};

      const userInfo = createUserAuditInfo(sessionItem as SessionItem);

      expect(userInfo).toStrictEqual(expectedUserInfo);
    });
  });

  describe("sendAuditEvent", () => {
    const ebMock = mockClient(EventBridgeClient);

    beforeEach(() => {
      ebMock.reset();
    });

    it("should successfully put audit event", async () => {
      ebMock.on(PutEventsCommand).resolves({
        Entries: [],
        FailedEntryCount: 0,
      });

      const config = new AbandonHandlerConfig();
      const userInfo = {
        govuk_signin_journey_id: "abc123",
        ip_address: "192.0.0.1",
        session_id: "session-id",
        user_id: "user-id",
        persistent_session_id: "persisent-id",
      };

      await expect(sendAuditEvent(config, userInfo, "txmaAuditHeader")).resolves.not.toThrow();
      const receivedCommand = ebMock.calls()[0].args[0] as PutEventsCommand;
      expect(receivedCommand.input).toEqual({
        Entries: [
          {
            Detail:
              '{"auditPrefix":"IPV_HMRC_RECORD_CHECK_CRI","user":{"govuk_signin_journey_id":"abc123","ip_address":"192.0.0.1","session_id":"session-id","user_id":"user-id","persistent_session_id":"persisent-id"},"deviceInformation":"txmaAuditHeader","issuer":"issuer"}',
            DetailType: "ABANDONED",
            EventBusName: "bus-name",
            Source: "bus-source",
          },
        ],
      });
    });

    it("should throw an Error if put command fails", async () => {
      ebMock.on(PutEventsCommand).rejects();

      const config = new AbandonHandlerConfig();
      const userInfo = {
        govuk_signin_journey_id: "abc123",
        ip_address: "192.0.0.1",
        session_id: "session-id",
        user_id: "user-id",
        persistent_session_id: "persisent-id",
      };

      await expect(sendAuditEvent(config, userInfo, "txmaAuditHeader")).rejects.toThrow(Error);
    });

    it("should throw an CriError if put command returns failed entries", async () => {
      ebMock.on(PutEventsCommand).resolves({
        Entries: [],
        FailedEntryCount: 1,
      });

      const config = new AbandonHandlerConfig();
      const userInfo = {
        govuk_signin_journey_id: "abc123",
        ip_address: "192.0.0.1",
        session_id: "session-id",
        user_id: "user-id",
        persistent_session_id: "persisent-id",
      };

      await expect(sendAuditEvent(config, userInfo, "txmaAuditHeader")).rejects.toThrow(CriError);
    });
  });
});
