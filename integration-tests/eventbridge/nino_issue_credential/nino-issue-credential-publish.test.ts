import { executeStepFunction } from "../../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  populateTables,
} from "../../resources/dynamodb-helper";

import {
  deleteQueue,
  getQueueMessages,
  setUpQueueAndAttachToRule,
  targetId,
} from "../../resources/queue-helper";
import { removeTargetFromRule } from "../../resources/event-bridge-helper";
import { pause, retry } from "../../resources/util";
import { CreateQueueCommandOutput } from "@aws-sdk/client-sqs";

jest.setTimeout(650_000);

type EvidenceRequest = {
  scoringPolicy: string;
  strengthScore: number;
};

describe("Nino Check Hmrc Issue Credential", () => {
  let sessionTableName: string;
  let personIdentityTableName: string;
  let checkHmrcEventBus: string;
  let txMaAuditEventRuleName: string;
  let vcIssuedRuleName: string;
  let endEventRuleName: string;
  let vcIssuedEventTestQueue: CreateQueueCommandOutput;
  let endEventTestQueue: CreateQueueCommandOutput;
  let txMaAuditEventTestQueue: CreateQueueCommandOutput;
  let userAttemptsTable: string;
  let ninoUsersTable: string;
  let ninoIssueCredentialStateMachineArn: string;
  let auditEventVcIssuedRule: string;
  let auditEventEndRule: string;
  let auditEventEndRuleArn: string;
  let auditEventVcIssuedRuleArn: string;
  let txMaAuditEventRule: string;
  let txMaAuditEventRuleArn: string;

  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };

  beforeEach(async () => {
    personIdentityTableName = `${process.env.PERSON_IDENTITY_TABLE}`;
    sessionTableName = `${process.env.SESSION_TABLE}`;
    ninoUsersTable = `${process.env.NINO_USERS_TABLE}`;
    userAttemptsTable = `${process.env.USERS_ATTEMPTS_TABLE}`;
    auditEventVcIssuedRule = `${process.env.AUDIT_EVENT_VC_ISSUED_RULE}`;
    auditEventEndRule = `${process.env.AUDIT_EVENT_END_RULE}`;
    txMaAuditEventRule = `${process.env.TXMA_AUDIT_EVENT_RULE_ENV}`;
    txMaAuditEventRuleArn = `${process.env.TXMA_AUDIT_EVENT_RULE_ARN}`;
    auditEventVcIssuedRuleArn = `${process.env.AUDIT_EVENT_VC_ISSUED_RULE_ARN}`;
    auditEventEndRuleArn = `${process.env.AUDIT_EVENT_END_RULE_ARN}`;
    ninoIssueCredentialStateMachineArn = `${process.env.NINO_CREDENTIAL_STATE_MACHINE_ARN}`;

    await Promise.all([
      populateTables(
        {
          tableName: ninoUsersTable as string,
          items: {
            sessionId: "issue-credential-happy-publish",
            nino: "AA000003D",
          },
        },
        {
          tableName: personIdentityTableName,
          items: {
            sessionId: "issue-credential-happy-publish",
            nino: "AA000003D",
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
      ),
      populateTables(
        {
          tableName: sessionTableName,
          items: getSessionItem(
            {
              sessionId: "issue-credential-happy-publish",
              nino: "AA000003D",
            },
            "Bearer unhappy"
          ),
        },
        {
          tableName: userAttemptsTable as string,
          items: {
            sessionId: "issue-credential-happy-publish",
            timestamp: Date.now().toString() + 1,
            attempt: "FAIL",
            status: 200,
            text: "DOB does not match CID, First Name does not match CID",
          },
        },
        {
          tableName: userAttemptsTable as string,
          items: {
            sessionId: "issue-credential-happy-publish",
            timestamp: Date.now().toString(),
            attempt: "FAIL",
            status: 200,
            text: "DOB does not match CID, First Name does not match CID",
          },
        }
      ),
    ]);
    [checkHmrcEventBus, vcIssuedRuleName] = auditEventVcIssuedRule.split("|");
    [checkHmrcEventBus, endEventRuleName] = auditEventEndRule.split("|");
    [checkHmrcEventBus, txMaAuditEventRuleName] = txMaAuditEventRule.split("|");
    vcIssuedEventTestQueue = await setUpQueueAndAttachToRule(
      auditEventVcIssuedRuleArn,
      vcIssuedRuleName,
      checkHmrcEventBus
    );
    endEventTestQueue = await setUpQueueAndAttachToRule(
      auditEventEndRuleArn,
      endEventRuleName,
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
        items: { sessionId: "issue-credential-happy-publish" },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: "issue-credential-happy-publish" },
      },
      {
        tableName: ninoUsersTable,
        items: { sessionId: "issue-credential-happy-publish" },
      }
    );

    await clearAttemptsTable(
      "issue-credential-happy-publish",
      userAttemptsTable
    );

    await removeTargetFromRule(targetId, checkHmrcEventBus, vcIssuedRuleName);
    await removeTargetFromRule(targetId, checkHmrcEventBus, endEventRuleName);
    await removeTargetFromRule(
      targetId,
      checkHmrcEventBus,
      txMaAuditEventRuleName
    );

    await retry(async () => {
      await deleteQueue(vcIssuedEventTestQueue.QueueUrl);
    });

    await retry(async () => {
      await deleteQueue(endEventTestQueue.QueueUrl);
    });

    await retry(async () => {
      await deleteQueue(txMaAuditEventTestQueue.QueueUrl);
    });

    await pause(30);
  });

  it("should publish END event to CheckHmrc EventBridge Bus successfully", async () => {
    const startExecutionResult = await getExecutionResult("Bearer unhappy");
    const endEventTestQueueMessage = await getQueueMessages(
      endEventTestQueue.QueueUrl as string
    );
    const { "detail-type": endDetailType, source: endSource } = JSON.parse(
      endEventTestQueueMessage[0].Body as string
    );

    expect(startExecutionResult.output).toBeDefined();
    expect(endEventTestQueueMessage).not.toHaveLength(0);
    expect(endDetailType).toBe("END");
    expect(endSource).toBe("review-hc.localdev.account.gov.uk");
  });
  it("should publish VC_ISSUED event to CheckHmrc EventBridge Bus", async () => {
    const startExecutionResult = await getExecutionResult("Bearer unhappy");

    const vcIssuedTestQueueMessage = await getQueueMessages(
      vcIssuedEventTestQueue.QueueUrl as string
    );

    const { "detail-type": vcIssuedDetailType, source: vcIssuedSource } =
      JSON.parse(vcIssuedTestQueueMessage[0].Body as string);

    expect(startExecutionResult.output).toBeDefined();
    expect(vcIssuedTestQueueMessage).not.toHaveLength(0);
    expect(vcIssuedDetailType).toBe("VC_ISSUED");
    expect(vcIssuedSource).toBe("review-hc.localdev.account.gov.uk");
  });
  it("should produce END and VC_ISSUED Events structure expected for the TxMA destination queue using target AuditEvent Step Function", async () => {
    const startExecutionResult = await getExecutionResult("Bearer unhappy");
    const txMaAuditEventTestQueueMessage = await getQueueMessages(
      txMaAuditEventTestQueue.QueueUrl as string
    );

    const txMaPayload = txMaAuditEventTestQueueMessage.map(
      (queueMessage) => JSON.parse(queueMessage.Body as string).detail
    );

    expect(startExecutionResult.output).toBeDefined();
    const endEvent = {
      component_id: "https://review-hc.dev.account.gov.uk",
      event_name: "IPV_HMRC_RECORD_CHECK_CRI_END",
      event_timestamp_ms: expect.any(Number),
      timestamp: expect.any(Number),
      user: {
        govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
        ip_address: "00.100.8.20",
        persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
        session_id: "issue-credential-happy-publish",
        user_id: "test",
      },
    };

    const vcIssuedEvent = {
      component_id: "https://review-hc.dev.account.gov.uk",
      event_name: "IPV_HMRC_RECORD_CHECK_CRI_VC_ISSUED",
      event_timestamp_ms: expect.any(Number),
      extensions: {
        evidence: [
          {
            attemptNum: 2,
            ciReasons: [
              {
                ci: expect.any(String),
                reason: expect.any(String),
              },
            ],
            failedCheckDetails: [
              { checkMethod: "data", dataCheck: "record_check" },
            ],
            txn: "mock-txn",
            type: "IdentityCheck",
          },
        ],
      },
      restricted: {
        birthDate: [{ value: "1948-04-23" }],
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
        session_id: "issue-credential-happy-publish",
        user_id: "test",
      },
    };
    expect(txMaPayload).toContainEqual(endEvent);
    expect(txMaPayload).toContainEqual(vcIssuedEvent);
  });

  const getExecutionResult = async (token: string) =>
    executeStepFunction(ninoIssueCredentialStateMachineArn, {
      bearerToken: token,
    });

  const getSessionItem = (
    input: {
      sessionId: string;
      nino: string;
    },
    accessToken: string,
    evidenceRequest?: EvidenceRequest
  ): {
    [x: string]: unknown;
  } => ({
    sessionId: input.sessionId,
    accessToken: accessToken,
    authorizationCode: "cd8ff974-d3bc-4422-9b38-a3e5eb24adc0",
    authorizationCodeExpiryDate: "1698925598",
    expiryDate: "9999999999",
    subject: "test",
    clientId: "exampleClientId",
    clientIpAddress: "00.100.8.20",
    clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
    persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
    evidenceRequest,
    txn: "mock-txn",
  });
});
