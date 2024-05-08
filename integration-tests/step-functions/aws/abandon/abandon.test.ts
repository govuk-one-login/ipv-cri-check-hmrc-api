import { CreateQueueCommandOutput } from "@aws-sdk/client-sqs";
import { stackOutputs } from "../../../resources/cloudformation-helper";
import {
  clearItems,
  getItemByKey,
  populateTable,
} from "../../../resources/dynamodb-helper";
import {
  addQueuePolicy,
  createQueue,
  deleteQueue,
  getQueueArn,
  getQueueMessages,
} from "../../../resources/queue-helper";
import { executeStepFunction } from "../../../resources/stepfunction-helper";
import {
  attachTargetToRule,
  removeTargetFromRule,
} from "../../../resources/event-bridge-helper";
import { RetryConfig, pause, retry } from "../../../resources/util";

describe("Abandon", () => {
  const input = {
    sessionId: "abandon-test",
    "txma-audit-encoded": "test encoded header",
  };
  let output: Partial<{
    CommonStackName: string;
    AbandonStateMachineArn: string;
  }>;

  let sessionTableName: string;
  describe("Step function execute AuthorizationCode is undefined", () => {
    beforeAll(async () => {
      output = await stackOutputs(process.env.STACK_NAME);
      sessionTableName = `session-${output.CommonStackName}`;
    });

    afterEach(async () => {
      await clearItems(sessionTableName, {
        sessionId: input.sessionId,
      });
    });

    it("should remove the authorizationCode when session exists", async () => {
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

    it("should return a 400 when session does not exist", async () => {
      const startExecutionResult = await executeStepFunction(
        output.AbandonStateMachineArn as string,
        input
      );
      expect(startExecutionResult.output).toBe('{"httpStatus":400}');
    });
  });

  describe("Step Function execute data publish for abandon event on queue", () => {
    jest.setTimeout(60_000);

    const targetId = `queue-target-id${Date.now()}`;

    let output: Partial<{
      CommonStackName: string;
      AbandonStateMachineArn: string;
      AuditEventAbandonedRule: string;
      AuditEventAbandonedRuleArn: string;
    }>;

    let sessionTableName: string;
    let queueResponse: CreateQueueCommandOutput;
    let queueArn: string | undefined;

    beforeAll(async () => {
      output = await stackOutputs(process.env.STACK_NAME);
      sessionTableName = `session-${output.CommonStackName}`;
      const auditEventAbandonedRule = output?.AuditEventAbandonedRule as string;
      const [eventBusName, ruleName] = auditEventAbandonedRule.split("|");
      queueResponse = await createQueue(`event-bus-test-Queue-${Date.now()}`);
      queueArn = (await getQueueArn(queueResponse.QueueUrl)) as string;
      await pause(15);

      await addQueuePolicy(
        queueArn,
        queueResponse.QueueUrl,
        output.AuditEventAbandonedRuleArn
      );

      await pause(15);
      await attachTargetToRule(targetId, eventBusName, ruleName, queueArn);
      await pause(15);
    });

    afterEach(async () => {
      const auditEventAbandonedRule = output?.AuditEventAbandonedRule as string;
      const [eventBusName, ruleName] = auditEventAbandonedRule.split("|");

      await clearItems(sessionTableName, {
        sessionId: input.sessionId,
      });
      await retry(
        { intervalInMs: 500, maxRetries: 20 },
        async () => await removeTargetFromRule(targetId, eventBusName, ruleName)
      );
      await retry(
        { intervalInMs: 500, maxRetries: 20 },
        async () => await deleteQueue(queueResponse.QueueUrl)
      );
    });

    it("should publish data for an abandon event", async () => {
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

      const startExecutionResult = await executeStepFunction(
        output.AbandonStateMachineArn as string,
        input
      );

      const messages = await getQueueMessages(
        queueResponse.QueueUrl as string,
        {
          intervalInMs: 0,
          maxRetries: 3,
        } as RetryConfig
      );
      const {
        "detail-type": detailType,
        source,
        detail,
      } = JSON.parse(messages[0].Body as string);

      expect(startExecutionResult.output).toBe('{"httpStatus":200}');

      expect(queueResponse).toBeDefined();
      expect(queueArn).toBeDefined();
      expect(detailType).toBe("ABANDONED");
      expect(source).toBe("review-hc.localdev.account.gov.uk");
      expect(detail).toEqual({
        auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
        deviceInformation: "test encoded header",
        user: {
          govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
          user_id: "test",
          persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
          session_id: "abandon-test",
          ip_address: "00.100.8.20",
        },
        issuer: "https://review-hc.dev.account.gov.uk",
      });
    });
  });
});
