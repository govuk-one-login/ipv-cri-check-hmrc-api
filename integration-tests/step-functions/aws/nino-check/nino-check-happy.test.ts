import { stackOutputs } from "../../../resources/cloudformation-helper";
import { executeStepFunction } from "../../../resources/stepfunction-helper";
import {
  clearItemsFromTables,
  clearAttemptsTable,
  populateTables,
} from "../../../resources/dynamodb-helper";
import { CreateQueueCommandOutput } from "@aws-sdk/client-sqs";
import {
  deleteQueue,
  getQueueMessages,
  setUpQueueAndAttachToRule,
  targetId,
} from "../../../resources/queue-helper";
import { removeTargetFromRule } from "../../../resources/event-bridge-helper";
import { pause, retry } from "../../../resources/util";

jest.setTimeout(30_000);

describe("nino-check-happy", () => {
  const input = {
    sessionId: "check-happy",
    nino: "AA000003D",
    "txma-audit-encoded": "test encoded header",
  };

  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };

  let sessionTableName: string;
  let personIdentityTableName: string;

  let output: Partial<{
    CommonStackName: string;
    UserAttemptsTable: string;
    NinoUsersTable: string;
    NinoCheckStateMachineArn: string;
    AuditEventRequestSentRule: string;
    AuditEventResponseReceivedRule: string;
    AuditEventRequestSentRuleArn: string;
    AuditEventResponseReceivedRuleArn: string;
    TxMaAuditEventRule: string;
    TxMaAuditEventRuleArn: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;

    await populateTables(
      {
        tableName: sessionTableName,
        items: {
          sessionId: input.sessionId,
          expiryDate: 9999999999,
          clientId: "ipv-core-stub-aws-prod",
          clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
          persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
          subject: "test",
          clientIpAddress: "00.100.8.20",
        },
      },
      {
        tableName: personIdentityTableName,
        items: {
          sessionId: input.sessionId,
          nino: input.nino,
          birthDates: [{ value: testUser.dob }],
          names: [
            {
              nameParts: [
                {
                  type: "GivenName",
                  value: testUser.firstName,
                },
                {
                  type: "FamilyName",
                  value: testUser.lastName,
                },
              ],
            },
          ],
        },
      }
    );
  });

  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: output.NinoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );
    await clearAttemptsTable(input.sessionId, output.UserAttemptsTable);
    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId: "check-unhappy" },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: "check-unhappy" },
      },
      {
        tableName: output.NinoUsersTable as string,
        items: { sessionId: "check-unhappy" },
      }
    );
    await clearAttemptsTable("check-unhappy", output.UserAttemptsTable);
  });

  describe("Step Function success", () => {
    it("should return 200 Ok on 1st attempt", async () => {
      const startExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        input
      );

      expect(startExecutionResult.output).toBe('{"httpStatus":200}');
    });

    it("should return 200 Ok while retrying the 2nd attempt", async () => {
      const inputNoCidNinoUser = {
        sessionId: "check-unhappy",
        nino: "AA000003C",
      };
      const testNoCidNinoUser = {
        nino: inputNoCidNinoUser.nino,
        dob: "1948-04-23",
        firstName: "Error",
        lastName: "NinoDoesNotMatchCID",
      };

      await populateTables(
        {
          tableName: sessionTableName,
          items: {
            sessionId: inputNoCidNinoUser.sessionId,
            expiryDate: 9999999999,
            clientId: "ipv-core-stub-aws-prod",
            clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
            persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
            subject: "test",
            clientIpAddress: "00.100.8.20",
          },
        },
        {
          tableName: personIdentityTableName,
          items: {
            sessionId: inputNoCidNinoUser.sessionId,
            nino: inputNoCidNinoUser.sessionId,
            birthDates: [{ value: testNoCidNinoUser.dob }],
            names: [
              {
                nameParts: [
                  {
                    type: "GivenName",
                    value: testNoCidNinoUser.firstName,
                  },
                  {
                    type: "FamilyName",
                    value: testNoCidNinoUser.lastName,
                  },
                ],
              },
            ],
          },
        }
      );

      const firstExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        {
          sessionId: inputNoCidNinoUser.sessionId,
          nino: testNoCidNinoUser.nino,
        }
      );

      const secondExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        input
      );

      expect(firstExecutionResult.output).toBe('{"httpStatus":422}');

      expect(secondExecutionResult.output).toBe('{"httpStatus":200}');
    });
  });

  describe("Nino Hmrc Check Step Function publishes to EventBridge Bus", () => {
    let requestSentEventTestQueue: CreateQueueCommandOutput;
    let responseReceivedEventTestQueue: CreateQueueCommandOutput;

    beforeEach(async () => {
      const [checkHmrcEventBus, requestSentRuleName] = (
        output.AuditEventRequestSentRule as string
      ).split("|");
      const [_, responseReceivedRuleName] = (
        output.AuditEventResponseReceivedRule as string
      ).split("|");

      requestSentEventTestQueue = await setUpQueueAndAttachToRule(
        output.AuditEventRequestSentRuleArn as string,
        requestSentRuleName,
        checkHmrcEventBus
      );
      responseReceivedEventTestQueue = await setUpQueueAndAttachToRule(
        output.AuditEventResponseReceivedRuleArn as string,
        responseReceivedRuleName,
        checkHmrcEventBus
      );
    });

    afterEach(async () => {
      const [checkHmrcEventBus, requestSentRuleName] = (
        output.AuditEventRequestSentRule as string
      ).split("|");
      const [_, responseReceivedRuleName] = (
        output.AuditEventResponseReceivedRule as string
      ).split("|");

      await retry(async () => {
        await Promise.all([
          removeTargetFromRule(
            targetId,
            checkHmrcEventBus,
            requestSentRuleName
          ),
          removeTargetFromRule(
            targetId,
            checkHmrcEventBus,
            responseReceivedRuleName
          ),
        ]);
      });
      await retry(async () => {
        await Promise.all([
          deleteQueue(requestSentEventTestQueue.QueueUrl),
          deleteQueue(responseReceivedEventTestQueue.QueueUrl),
        ]);
        await pause(60);
      });
    });
    it("should publish REQUEST_SENT event to CheckHmrcBus successfully", async () => {
      const startExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        input
      );
      const requestSentQueueMessage = await getQueueMessages(
        requestSentEventTestQueue.QueueUrl as string
      );
      const {
        "detail-type": requestSentDetailType,
        source: requestSentSource,
      } = JSON.parse(requestSentQueueMessage[0].Body as string);

      expect(startExecutionResult.output).toBe('{"httpStatus":200}');

      expect(startExecutionResult.output).toBeDefined();
      expect(requestSentQueueMessage).not.toHaveLength(0);
      expect(requestSentDetailType).toBe("REQUEST_SENT");
      expect(requestSentSource).toBe("review-hc.localdev.account.gov.uk");
    });
    it("should publish RESPONSE_RECEIVED event to CheckHmrcBus successfully", async () => {
      const startExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        input
      );

      const responseReceivedQueueMessage = await getQueueMessages(
        responseReceivedEventTestQueue.QueueUrl as string
      );
      const {
        "detail-type": responseReceivedDetailType,
        source: responseReceivedSource,
      } = JSON.parse(responseReceivedQueueMessage[0].Body as string);

      expect(startExecutionResult.output).toBe('{"httpStatus":200}');

      expect(startExecutionResult.output).toBeDefined();
      expect(responseReceivedQueueMessage).not.toHaveLength(0);
      expect(responseReceivedDetailType).toBe("RESPONSE_RECEIVED");
      expect(responseReceivedSource).toBe("review-hc.localdev.account.gov.uk");
    });
  });
  describe("Nino Hmrc Issue Credential Step Function execution causes AuditEvent step function to receive published events", () => {
    jest.setTimeout(120_000);
    let txMaAuditEventTestQueue: CreateQueueCommandOutput;

    beforeEach(async () => {
      const [checkHmrcEventBus, txMaAuditEventRuleName] = (
        output.TxMaAuditEventRule as string
      ).split("|");
      txMaAuditEventTestQueue = await setUpQueueAndAttachToRule(
        output.TxMaAuditEventRuleArn as string,
        txMaAuditEventRuleName,
        checkHmrcEventBus
      );
    });
    afterEach(async () => {
      const [checkHmrcEventBus, txMaAuditEventRuleName] = (
        output.TxMaAuditEventRule as string
      ).split("|");
      txMaAuditEventTestQueue = await setUpQueueAndAttachToRule(
        output.TxMaAuditEventRuleArn as string,
        txMaAuditEventRuleName,
        checkHmrcEventBus
      );
      await retry(async () => {
        await removeTargetFromRule(
          targetId,
          checkHmrcEventBus,
          txMaAuditEventRuleName
        );
      });
      await retry(async () => {
        await deleteQueue(txMaAuditEventTestQueue.QueueUrl);
      });
    });
    it("should produce REQUEST_SENT and RESPONSE_RECEIVED Events structure expected for TxMA queue", async () => {
      const startExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        input
      );
      const txMaAuditEventTestQueueMessage = await getQueueMessages(
        txMaAuditEventTestQueue.QueueUrl as string
      );

      const txMaPayload = txMaAuditEventTestQueueMessage.map(
        (queueMessage) => JSON.parse(queueMessage.Body as string).detail
      );

      expect(startExecutionResult.output).toBeDefined();
      const expectedAuditEventPayloads = [
        {
          component_id: "https://review-hc.dev.account.gov.uk",
          event_name: "IPV_HMRC_RECORD_CHECK_CRI_REQUEST_SENT",
          event_timestamp_ms: expect.any(Number),
          restricted: {
            birthDate: [{ value: "1948-04-23" }],
            device_information: { encoded: "test encoded header" },
            name: [
              {
                nameParts: [
                  { type: "GivenName", value: "Jim" },
                  { type: "FamilyName", value: "Ferguson" },
                ],
              },
            ],
            socialSecurityRecord: [{ personalNumber: "AA000003D" }],
          },
          timestamp: expect.any(Number),
          user: {
            govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
            ip_address: "00.100.8.20",
            persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
            session_id: "check-happy",
            user_id: "test",
          },
        },
        {
          component_id: "https://review-hc.dev.account.gov.uk",
          event_name: "IPV_HMRC_RECORD_CHECK_CRI_RESPONSE_RECEIVED",
          event_timestamp_ms: expect.any(Number),
          restricted: {
            device_information: { encoded: "test encoded header" },
          },
          timestamp: expect.any(Number),
          user: {
            govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
            ip_address: "00.100.8.20",
            persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
            session_id: "check-happy",
            user_id: "test",
          },
        },
      ];
      expect(txMaPayload).toContainEqual(expectedAuditEventPayloads[0]);
      expect(txMaPayload).toContainEqual(expectedAuditEventPayloads[1]);
    });
  });
});
