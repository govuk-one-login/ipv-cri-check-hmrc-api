import { CreateQueueCommandOutput } from "@aws-sdk/client-sqs";
import { stackOutputs } from "../../resources/cloudformation-helper";
import { clearItems, populateTable } from "../../resources/dynamodb-helper";
import {
  deleteQueue,
  getQueueMessages,
  setUpQueueAndAttachToRule,
  targetId,
} from "../../resources/queue-helper";
import { executeStepFunction } from "../../resources/stepfunction-helper";
import { removeTargetFromRule } from "../../resources/event-bridge-helper";
import { pause, retry } from "../../resources/util";

describe("Abandon Step Function", () => {
  jest.setTimeout(30_0000); // 5 minutes

  const input = {
    sessionId: "abandon-test-publish",
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
  let checkHmrcEventBus: string;
  let auditEventAbandonedRule: string;
  let txMaAuditEventRuleName: string;
  let abandonedEventTestQueue: CreateQueueCommandOutput;
  let txMaAuditEventTestQueue: CreateQueueCommandOutput;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;

    [checkHmrcEventBus, auditEventAbandonedRule] = (
      output?.AuditEventAbandonedRule as string
    ).split("|");
    [checkHmrcEventBus, txMaAuditEventRuleName] = (
      output.TxMaAuditEventRule as string
    ).split("|");

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

    abandonedEventTestQueue = await setUpQueueAndAttachToRule(
      output.AuditEventAbandonedRuleArn as string,
      auditEventAbandonedRule,
      checkHmrcEventBus
    );
    txMaAuditEventTestQueue = await setUpQueueAndAttachToRule(
      output.TxMaAuditEventRuleArn as string,
      txMaAuditEventRuleName,
      checkHmrcEventBus
    );
  });

  afterEach(async () => {
    // Clear items from the session table
    await clearItems(sessionTableName, {
      sessionId: input.sessionId,
    });

    // Retry removing the first target from the txMaAuditEventRuleName
    await retry(async () => {
      await removeTargetFromRule(
        targetId,
        checkHmrcEventBus,
        txMaAuditEventRuleName
      );
    });

    // Retry removing the second target from the auditEventAbandonedRule
    await retry(async () => {
      await removeTargetFromRule(
        targetId,
        checkHmrcEventBus,
        auditEventAbandonedRule
      );
    });

    // Retry deleting the abandonedEventTestQueue SQS queue
    await retry(async () => {
      await deleteQueue(abandonedEventTestQueue.QueueUrl);
    });

    // Retry deleting the txMaAuditEventTestQueue SQS queue
    await retry(async () => {
      await deleteQueue(txMaAuditEventTestQueue.QueueUrl);
    });

    // Pause to ensure the queues are fully deleted
    await pause(30);
  });

  it("should publish ABANDONED event to a queue with an abandoned rule set", async () => {
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
  it("should produce ABANDONED Event structure for the TxMA destination queue using target AuditEvent Step Function", async () => {
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
        session_id: "abandon-test-publish",
        user_id: "test",
      },
    });
  });
});
