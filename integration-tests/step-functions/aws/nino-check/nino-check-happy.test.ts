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
import { RetryConfig, retry } from "../../../resources/util";

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

  describe("Nino Hmrc Check Step Function execution", () => {
    jest.setTimeout(120_000);
    let requestSentEventTestQueue: CreateQueueCommandOutput;
    let responseReceivedEventTestQueue: CreateQueueCommandOutput;

    beforeEach(async () => {
      const [requestSentBusName, requestSentRuleName] = (
        output.AuditEventRequestSentRule as string
      ).split("|");
      const [responseReceivedBusName, responseReceivedRuleName] = (
        output.AuditEventResponseReceivedRule as string
      ).split("|");

      requestSentEventTestQueue = await setUpQueueAndAttachToRule(
        output.AuditEventRequestSentRuleArn as string,
        requestSentRuleName,
        requestSentBusName
      );
      responseReceivedEventTestQueue = await setUpQueueAndAttachToRule(
        output.AuditEventResponseReceivedRuleArn as string,
        responseReceivedRuleName,
        responseReceivedBusName
      );
    });

    afterEach(async () => {
      const [requestSentBusName, requestSentRuleName] = (
        output.AuditEventRequestSentRule as string
      ).split("|");
      const [responseReceivedBusName, responseReceivedRuleName] = (
        output.AuditEventResponseReceivedRule as string
      ).split("|");

      await retry({ intervalInMs: 1000, maxRetries: 20 }, async () => {
        await removeTargetFromRule(
          targetId,
          requestSentBusName,
          requestSentRuleName
        );
        await removeTargetFromRule(
          targetId,
          responseReceivedBusName,
          responseReceivedRuleName
        );
      });
      await retry({ intervalInMs: 1000, maxRetries: 20 }, async () => {
        await deleteQueue(requestSentEventTestQueue.QueueUrl);
        await deleteQueue(responseReceivedEventTestQueue.QueueUrl);
      });
    });
    it("publishes REQUEST_SENT and RESPONSE_RECEIVED events successfully", async () => {
      const startExecutionResult = await executeStepFunction(
        output.NinoCheckStateMachineArn as string,
        input
      );
      const requestSentQueueMessage = await getQueueMessages(
        requestSentEventTestQueue.QueueUrl as string,
        {
          intervalInMs: 0,
          maxRetries: 10,
        } as RetryConfig
      );
      const responseReceivedQueueMessage = await getQueueMessages(
        responseReceivedEventTestQueue.QueueUrl as string,
        {
          intervalInMs: 0,
          maxRetries: 10,
        } as RetryConfig
      );
      const {
        "detail-type": requestSentDetailType,
        source: requestSentSource,
        detail: requestSentDetail,
      } = JSON.parse(requestSentQueueMessage[0].Body as string);
      const {
        "detail-type": responseReceivedDetailType,
        source: responseReceivedSource,
        detail: responseReceivedDetail,
      } = JSON.parse(responseReceivedQueueMessage[0].Body as string);

      expect(startExecutionResult.output).toBe('{"httpStatus":200}');

      expect(startExecutionResult.output).toBeDefined();
      expect(requestSentDetailType).toBe("REQUEST_SENT");
      expect(requestSentSource).toBe("review-hc.localdev.account.gov.uk");
      expect(requestSentDetail).toEqual({
        auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
        deviceInformation: "test encoded header",
        nino: "AA000003D",
        user: {
          govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
          user_id: "test",
          persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
          session_id: "check-happy",
          ip_address: "00.100.8.20",
        },
        userInfoEvent: {
          Count: 1,
          Items: [
            {
              names: {
                L: [
                  {
                    M: {
                      nameParts: {
                        L: [
                          {
                            M: {
                              type: {
                                S: "GivenName",
                              },
                              value: {
                                S: "Jim",
                              },
                            },
                          },
                          {
                            M: {
                              type: {
                                S: "FamilyName",
                              },
                              value: {
                                S: "Ferguson",
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
              sessionId: {
                S: "check-happy",
              },
              birthDates: {
                L: [
                  {
                    M: {
                      value: {
                        S: "1948-04-23",
                      },
                    },
                  },
                ],
              },
              nino: {
                S: "AA000003D",
              },
            },
          ],
          ScannedCount: 1,
        },
        issuer: "https://review-hc.dev.account.gov.uk",
      });

      expect(responseReceivedDetailType).toBe("RESPONSE_RECEIVED");
      expect(responseReceivedSource).toBe("review-hc.localdev.account.gov.uk");
      expect(responseReceivedDetail).toEqual({
        auditPrefix: "IPV_HMRC_RECORD_CHECK_CRI",
        deviceInformation: "test encoded header",
        user: {
          govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
          user_id: "test",
          persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
          session_id: "check-happy",
          ip_address: "00.100.8.20",
        },
        issuer: "https://review-hc.dev.account.gov.uk",
      });
    });
  });
});
