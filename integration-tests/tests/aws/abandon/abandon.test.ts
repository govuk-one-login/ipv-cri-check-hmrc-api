import { stackOutputs } from "../resources/cloudformation-helper";
import {
  clearItems,
  getItemByKey,
  populateTable,
} from "../resources/dynamodb-helper";
import { executeStepFunction } from "../resources/stepfunction-helper";

describe("abandon", () => {
  const input = {
    sessionId: "abandon-test",
  };

  let output: Partial<{
    CommonStackName: string;
    AbandonStateMachineArn: string;
  }>;

  let sessionTableName: string;

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
