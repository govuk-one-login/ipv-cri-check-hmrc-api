import { CreateQueueCommandOutput } from "@aws-sdk/client-sqs";
import { stackOutputs } from "../../../resources/cloudformation-helper";
import {
  clearItems,
  getItemByKey,
  populateTable,
} from "../../../resources/dynamodb-helper";
import {
  deleteQueue,
  getQueueMessages,
  setUpQueueAndAttachToRule,
  targetId,
} from "../../../resources/queue-helper";
import { executeStepFunction } from "../../../resources/stepfunction-helper";
import { removeTargetFromRule } from "../../../resources/event-bridge-helper";
import { pause, retry } from "../../../resources/util";

describe("Abandon", () => {
  const input = {
    sessionId: "abandon-test",
    "txma-audit-encoded": "test encoded header",
  };

  let output: Partial<{
    CommonStackName: string;
    AbandonStateMachineArn: string;
    AuditEventAbandonedRule: string;
    AuditEventAbandonedRuleArn: string;
    TxMaAuditEventRule: string;
    TxMaAuditEventRuleArn: string;
  }>;

  let sessionTableName: string;
  let abandonedEventTestQueue: CreateQueueCommandOutput;

  it("should return a 400 when session does not exist", async () => {
    output = await stackOutputs(process.env.STACK_NAME);

    const startExecutionResult = await executeStepFunction(
      output.AbandonStateMachineArn as string,
      input
    );
    expect(startExecutionResult.output).toBe('{"httpStatus":400}');
  });
  describe("step function execution", () => {
    beforeEach(async () => {
      output = await stackOutputs(process.env.STACK_NAME);
      sessionTableName = `session-${output.CommonStackName}`;

      await populateTable(sessionTableName, {
        sessionId: input.sessionId,
        expiryDate: 9999999999,
        clientId: "exampleClientId",
        authorizationCode: "9999999999",
        authorizationCodeExpiryDate: "9999999999",
        clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
        persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
        clientIpAddress: "00.100.8.20",
        subject: "test",
      });

      const [checkHmrcEventBus, auditEventAbandonedRule] = (
        output?.AuditEventAbandonedRule as string
      ).split("|");

      abandonedEventTestQueue = await setUpQueueAndAttachToRule(
        output.AuditEventAbandonedRuleArn as string,
        auditEventAbandonedRule,
        checkHmrcEventBus
      );
    });
    afterEach(async () => {
      await clearItems(sessionTableName, {
        sessionId: input.sessionId,
      });

      const [checkHmrcEventBus, auditEventAbandonedRule] = (
        output?.AuditEventAbandonedRule as string
      ).split("|");

      await retry(async () => {
        await removeTargetFromRule(
          targetId,
          checkHmrcEventBus,
          auditEventAbandonedRule
        );
      });
    });
    it("should remove the authorizationCode when session exists", async () => {
      const startExecutionResult = await executeStepFunction(
        output.AbandonStateMachineArn as string,
        input
      );

      const sessionRecord = await getItemByKey(sessionTableName, {
        sessionId: input.sessionId,
      });

      expect(startExecutionResult.output).toBe('{"httpStatus":200}');
      expect(sessionRecord.Item?.authorizationCode).toBeUndefined();
      expect(sessionRecord.Item?.authorizationCodeExpiryDate).toBe(0);
    });

    describe("publishes to EventBridge Bus", () => {
      it("should publish ABANDONED event to CheckHmrcBus successfully", async () => {
        const startExecutionResult = await executeStepFunction(
          output.AbandonStateMachineArn as string,
          input
        );
        const messages = await getQueueMessages(
          abandonedEventTestQueue.QueueUrl as string
        );
        const { "detail-type": detailType, source } = JSON.parse(
          messages[0].Body as string
        );

        expect(startExecutionResult.output).toBe('{"httpStatus":200}');

        expect(detailType).toBe("ABANDONED");
        expect(source).toBe("review-hc.localdev.account.gov.uk");
      });
    });
    describe("AuditEvent step function to receives published events", () => {
      jest.setTimeout(100_000);
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
          await pause(60);
        });
      });
      it("should produce ABANDONED Event structure for the TxMA destination queue", async () => {
        const startExecutionResult = await executeStepFunction(
          output.AbandonStateMachineArn as string,
          input
        );
        const txMaAuditEventTestQueueMessage = await getQueueMessages(
          txMaAuditEventTestQueue.QueueUrl as string
        );

        const txMaPayload = txMaAuditEventTestQueueMessage.map(
          (queueMessage) => JSON.parse(queueMessage.Body as string).detail
        );

        expect(startExecutionResult.output).toBeDefined();

        expect(txMaPayload).toContainEqual({
          component_id: "https://review-hc.dev.account.gov.uk",
          event_name: "IPV_HMRC_RECORD_CHECK_CRI_ABANDONED",
          event_timestamp_ms: expect.any(Number),
          restricted: {
            device_information: { encoded: "test encoded header" },
          },
          timestamp: expect.any(Number),
          user: {
            govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
            ip_address: "00.100.8.20",
            persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
            session_id: "abandon-test",
            user_id: "test",
          },
        });
      });
    });
  });
});
