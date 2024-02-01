import { stackOutputs } from "../resources/cloudformation-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";
import {
  clearItemsFromTables,
  clearAttemptsTable,
  populateTables,
} from "../resources/dynamodb-helper";
import { clearSQSQueue, getMessagesFromQueue } from "../resources/sqs-helper";

jest.setTimeout(30_000);

describe("nino-check-happy", () => {
  const input = {
    sessionId: "check-happy",
    nino: "AA000003D",
  };

  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };

  let sessionTableName: string;
  let personIdentityTableName: string;
  let sqsQueueUrl: string;

  let output: Partial<{
    CommonStackName: string;
    UserAttemptsTable: string;
    NinoUsersTable: string;
    NinoCheckStateMachineArn: string;
  }>;

  afterAll(async () => {
    await clearSQSQueue(sqsQueueUrl);
  });

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;
    sqsQueueUrl =
      "https://sqs.eu-west-2.amazonaws.com/562670266496/suraj-spike-sqs-AuditEventQueue-tbSC0vuCYDYB";

    await populateTables(
      {
        tableName: sessionTableName,
        items: {
          sessionId: input.sessionId,
          expiryDate: 9999999999,
          clientId: "exampleClientId",
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
  });

  it("should execute nino step function 1st attempt", async () => {
    const startExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      input
    );
    const messagesOnQueue = await getMessagesFromQueue(sqsQueueUrl);
    const msg = JSON.parse(messagesOnQueue[0]);
    expect(messagesOnQueue.length).toBeGreaterThan(0);
    expect(msg.event_name).toBe("suraj-test-event");
    expect(startExecutionResult.output).toBe('{"httpStatus":200}');
  });

  it("should execute nino step function 2nd attempt", async () => {
    const firstExecutionResult = await executeStepFunction(
      output.NinoCheckStateMachineArn as string,
      {
        sessionId: input.sessionId,
        nino: "NoCidNino",
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
