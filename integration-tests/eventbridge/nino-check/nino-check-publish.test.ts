import { executeStepFunction } from "../../resources/stepfunction-helper";
import {
  clearItemsFromTables,
  clearAttemptsTable,
  populateTables,
} from "../../resources/dynamodb-helper";
import { CreateQueueCommandOutput } from "@aws-sdk/client-sqs";
import {
  deleteQueue,
  getQueueMessages,
  setUpQueueAndAttachToRule,
  targetId,
} from "../../resources/queue-helper";
import { removeTargetFromRule } from "../../resources/event-bridge-helper";
import { pause, retry } from "../../resources/util";

jest.setTimeout(650_000);

describe("Nino Hmrc Check Step Function", () => {
  const input = {
    sessionId: "check-happy-publish",
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
  let checkHmrcEventBus: string;
  let requestSentRuleName: string;
  let responseReceivedRuleName: string;
  let txMaAuditEventRuleName: string;
  let requestSentEventTestQueue: CreateQueueCommandOutput;
  let responseReceivedEventTestQueue: CreateQueueCommandOutput;
  let txMaAuditEventTestQueue: CreateQueueCommandOutput;
  let userAttemptsTable: string;
  let ninoUsersTable: string;
  let ninoCheckStateMachineArn: string;
  let auditEventRequestSentRule: string;
  let auditEventResponseReceivedRule: string;
  let auditEventRequestSentRuleArn: string;
  let auditEventResponseReceivedRuleArn: string;
  let txMaAuditEventRule: string;
  let txMaAuditEventRuleArn: string;

  beforeEach(async () => {
    personIdentityTableName = `${process.env.PERSON_IDENTITY_TABLE}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    ninoUsersTable = `${process.env.NINO_USERS_TABLE}`;
    userAttemptsTable = `${process.env.USERS_ATTEMPTS_TABLE}`;
    txMaAuditEventRule = `${process.env.TXMA_AUDIT_EVENT_RULE_ENV}`;
    txMaAuditEventRuleArn = `${process.env.TXMA_AUDIT_EVENT_RULE_ARN}`;
    auditEventRequestSentRule = `${process.env.AUDIT_EVENT_REQUEST_SENT_RULE}`;
    auditEventRequestSentRuleArn = `${process.env.AUDIT_EVENT_REQUEST_SENT_RULE_ARN}`;
    auditEventResponseReceivedRule = `${process.env.AUDIT_EVENT_RESPONSE_RECEIVED_RULE}`;
    auditEventResponseReceivedRuleArn = `${process.env.AUDIT_EVENT_RESPONSE_RECEIVED_RULE_ARN}`;
    ninoCheckStateMachineArn = `${process.env.NINO_CHECK_STATE_MACHINE_ARN}`;

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

    [checkHmrcEventBus, requestSentRuleName] =
      auditEventRequestSentRule.split("|");
    [checkHmrcEventBus, responseReceivedRuleName] =
      auditEventResponseReceivedRule.split("|");
    [checkHmrcEventBus, txMaAuditEventRuleName] = (
      txMaAuditEventRule as string
    ).split("|");

    requestSentEventTestQueue = await setUpQueueAndAttachToRule(
      auditEventRequestSentRuleArn,
      requestSentRuleName,
      checkHmrcEventBus
    );
    responseReceivedEventTestQueue = await setUpQueueAndAttachToRule(
      auditEventResponseReceivedRuleArn,
      responseReceivedRuleName,
      checkHmrcEventBus
    );
    txMaAuditEventTestQueue = await setUpQueueAndAttachToRule(
      txMaAuditEventRuleArn,
      txMaAuditEventRuleName,
      checkHmrcEventBus
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
        tableName: ninoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );

    await clearAttemptsTable(input.sessionId, userAttemptsTable);

    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId: "check-happy-publish" },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: "check-happy-publish" },
      },
      {
        tableName: ninoUsersTable,
        items: { sessionId: "check-happy-publish" },
      }
    );

    await clearAttemptsTable("check-happy-publish", userAttemptsTable);

    await retry(async () => {
      await removeTargetFromRule(
        targetId,
        checkHmrcEventBus,
        requestSentRuleName
      );
    });

    await retry(async () => {
      await removeTargetFromRule(
        targetId,
        checkHmrcEventBus,
        responseReceivedRuleName
      );
    });

    await retry(async () => {
      await removeTargetFromRule(
        targetId,
        checkHmrcEventBus,
        txMaAuditEventRuleName
      );
    });

    await retry(async () => {
      await deleteQueue(requestSentEventTestQueue.QueueUrl);
    });

    await retry(async () => {
      await deleteQueue(responseReceivedEventTestQueue.QueueUrl);
    });

    await retry(async () => {
      await deleteQueue(txMaAuditEventTestQueue.QueueUrl);
    });

    await pause(30);
  });

  it("should publish REQUEST_SENT event to CheckHmrc EventBridge Bus successfully", async () => {
    const startExecutionResult = await executeStepFunction(
      ninoCheckStateMachineArn,
      input
    );
    const requestSentQueueMessage = await getQueueMessages(
      requestSentEventTestQueue.QueueUrl as string
    );
    const { "detail-type": requestSentDetailType, source: requestSentSource } =
      JSON.parse(requestSentQueueMessage[0].Body as string);

    expect(startExecutionResult.output).toBe(
      '{"httpStatus":200,"body":"{\\"requestRetry\\":false}"}'
    );

    expect(startExecutionResult.output).toBeDefined();
    expect(requestSentQueueMessage).not.toHaveLength(0);
    expect(requestSentDetailType).toBe("REQUEST_SENT");
    expect(requestSentSource).toBe("review-hc.localdev.account.gov.uk");
  });
  it("should publish RESPONSE_RECEIVED event to CheckHmrc EventBridge Bus successfully", async () => {
    const startExecutionResult = await executeStepFunction(
      ninoCheckStateMachineArn,
      input
    );

    const responseReceivedQueueMessage = await getQueueMessages(
      responseReceivedEventTestQueue.QueueUrl as string
    );
    const {
      "detail-type": responseReceivedDetailType,
      source: responseReceivedSource,
    } = JSON.parse(responseReceivedQueueMessage[0].Body as string);

    expect(startExecutionResult.output).toBeDefined();
    expect(JSON.parse(startExecutionResult.output || "")).toStrictEqual({
      httpStatus: 200,
      body: '{"requestRetry":false}',
    });

    expect(responseReceivedQueueMessage).not.toHaveLength(0);
    expect(responseReceivedDetailType).toBe("RESPONSE_RECEIVED");
    expect(responseReceivedSource).toBe("review-hc.localdev.account.gov.uk");
  });
  it("should produce REQUEST_SENT and RESPONSE_RECEIVED Events structure expected for TxMA queue using target AuditEvent Step Function", async () => {
    const startExecutionResult = await executeStepFunction(
      ninoCheckStateMachineArn,
      input
    );
    const txMaAuditEventTestQueueMessage = await getQueueMessages(
      txMaAuditEventTestQueue.QueueUrl as string
    );

    const txMaPayload = txMaAuditEventTestQueueMessage.map(
      (queueMessage) => JSON.parse(queueMessage.Body as string).detail
    );

    expect(startExecutionResult.output).toBeDefined();
    const requestSentEvent = {
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
        session_id: "check-happy-publish",
        user_id: "test",
      },
    };
    const responseRecievedEvent = {
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
        session_id: "check-happy-publish",
        user_id: "test",
      },
      extensions: {
        evidence: [
          {
            txn: "mock_txn_header",
          },
        ],
      },
    };

    expect(txMaPayload).toContainEqual(requestSentEvent);
    expect(txMaPayload).toContainEqual(responseRecievedEvent);
  });
});
