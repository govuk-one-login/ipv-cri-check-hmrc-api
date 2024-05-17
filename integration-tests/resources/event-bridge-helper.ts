import {
  EventBridgeClient,
  ListTargetsByRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import { createSendCommand } from "./aws-helper";

const sendCommand = createSendCommand(
  () => new EventBridgeClient({ region: process.env.AWS_REGION })
);

export const attachTargetToRule = async (
  targetId: string,
  eventBusName?: string,
  ruleName?: string,
  targetArn?: string
) => {
  if (!ruleName) throw new Error(`RuleName not valid, value is: ${ruleName}`);
  if (!eventBusName)
    throw new Error(`EventBusName not valid, value is: ${eventBusName}`);
  if (!targetArn)
    throw new Error(`TargetArn not valid, value is: ${targetArn}`);

  const response = sendCommand(ListTargetsByRuleCommand, {
    Rule: ruleName,
    EventBusName: eventBusName,
  });
  if (((await response).Targets || [])?.length < 5) {
    sendCommand(PutTargetsCommand, {
      Rule: ruleName,
      EventBusName: eventBusName,
      Targets: [
        {
          Arn: targetArn,
          Id: targetId,
        },
      ],
    });
  }
};

export const removeTargetFromRule = async (
  targetId: string,
  eventBusName: string,
  ruleName?: string
) =>
  sendCommand(RemoveTargetsCommand, {
    Rule: ruleName,
    EventBusName: eventBusName,
    Ids: [targetId],
  });
