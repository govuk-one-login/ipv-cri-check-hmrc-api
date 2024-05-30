import { stackOutputs } from "../../resources/cloudformation-helper";
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

    [checkHmrcEventBus, requestSentRuleName] = (
      output.AuditEventRequestSentRule as string
    ).split("|");
    [checkHmrcEventBus, responseReceivedRuleName] = (
      output.AuditEventResponseReceivedRule as string
    ).split("|");
    [checkHmrcEventBus, txMaAuditEventRuleName] = (
      output.TxMaAuditEventRule as string
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
    txMaAuditEventTestQueue = await setUpQueueAndAttachToRule(
      output.TxMaAuditEventRuleArn as string,
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
        tableName: output.NinoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );

    await clearAttemptsTable(input.sessionId, output.UserAttemptsTable);

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
        tableName: output.NinoUsersTable as string,
        items: { sessionId: "check-happy-publish" },
      }
    );

    await clearAttemptsTable("check-happy-publish", output.UserAttemptsTable);

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
      output.NinoCheckStateMachineArn as string,
      input
    );
    const requestSentQueueMessage = await getQueueMessages(
      requestSentEventTestQueue.QueueUrl as string
    );
    const { "detail-type": requestSentDetailType, source: requestSentSource } =
      JSON.parse(requestSentQueueMessage[0].Body as string);

    expect(startExecutionResult.output).toBe('{"httpStatus":200}');

    expect(startExecutionResult.output).toBeDefined();
    expect(requestSentQueueMessage).not.toHaveLength(0);
    expect(requestSentDetailType).toBe("REQUEST_SENT");
    expect(requestSentSource).toBe("review-hc.localdev.account.gov.uk");
  });
  it("should publish RESPONSE_RECEIVED event to CheckHmrc EventBridge Bus successfully", async () => {
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
  it("should produce REQUEST_SENT and RESPONSE_RECEIVED Events structure expected for TxMA queue using target AuditEvent Step Function", async () => {
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
    };

    expect(txMaPayload).toContainEqual(requestSentEvent);
    expect(txMaPayload).toContainEqual(responseRecievedEvent);
  });
});
