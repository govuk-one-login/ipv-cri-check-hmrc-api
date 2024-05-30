import {
  CreateQueueCommand,
  CreateQueueCommandOutput,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  Message,
  QueueAttributeName,
  ReceiveMessageCommand,
  SQSClient,
  SetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { createSendCommand } from "./aws-helper";
import { RetryConfig, pause, retry } from "./util";
import { attachTargetToRule } from "./event-bridge-helper";
import { v4 as uuidv4 } from "uuid";

export const targetId = `queue-target-id${uuidv4()}`;

const sendCommand = createSendCommand(
  () =>
    new SQSClient({
      region: process.env.AWS_REGION,
    })
);
export const createQueue = async (
  queueName: string,
  Attributes?: Partial<Record<QueueAttributeName, string>>
) => {
  const response = sendCommand(CreateQueueCommand, {
    QueueName: queueName,
    Attributes,
  });

  return response;
};

export const getQueueArn = async (queueUrl?: string) => {
  const { Attributes } = await sendCommand(GetQueueAttributesCommand, {
    QueueUrl: queueUrl,
    AttributeNames: ["QueueArn"],
  });
  return Attributes?.QueueArn;
};

export const setQueueAttributes = async (
  QueueUrl: string,
  Attributes: Partial<Record<QueueAttributeName, string>>
) => {
  const response = sendCommand(SetQueueAttributesCommand, {
    QueueUrl,
    Attributes,
  });
  return response;
};

export const addQueuePolicy = async (
  queueArn?: string,
  queueUrl?: string,
  resourceArn?: string
) => {
  if (!queueArn) throw Error(`QueueArn not valid, value is: ${queueArn}`);
  if (!queueUrl) throw Error(`QueueUrl not valid, value is: ${queueUrl}`);
  if (!resourceArn)
    throw Error(`ResourceArn not valid, value is: ${resourceArn} `);

  const Policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: `sqs-Allow-eventBridge-to-sendMessage-${uuidv4()}`,
        Effect: "Allow",
        Principal: {
          Service: "events.amazonaws.com",
        },
        Action: "sqs:SendMessage",
        Resource: queueArn,
        Condition: {
          ArnEquals: {
            "aws:SourceArn": resourceArn,
          },
        },
      },
    ],
  });
  await sendCommand(SetQueueAttributesCommand, {
    QueueUrl: queueUrl,
    Attributes: {
      Policy,
    },
  });
};
export const getQueueMessages = async (
  queueUrl: string
): Promise<Message[]> => {
  try {
    let allMessages: Message[] = [];
    let shouldContinue = true;

    while (shouldContinue) {
      const { Messages } = await sendCommand(ReceiveMessageCommand, {
        QueueUrl: queueUrl,
        WaitTimeSeconds: 10,
      });

      if (!Messages || Messages.length === 0) {
        shouldContinue = false;
      } else {
        allMessages = allMessages.concat(Messages);
      }
    }

    if (allMessages.length === 0) {
      throw new Error("No messages received.");
    }

    return allMessages;
  } catch (error) {
    throw new Error("No messages received: " + error);
  }
};
export const setUpQueueAndAttachToRule = async (
  ruleArn: string,
  ruleName: string,
  eventBusName: string
) => {
  const queueResponse: CreateQueueCommandOutput = await createQueue(
    `event-bus-test-Queue-${uuidv4()}`
  );
  const queueArn = (await getQueueArn(queueResponse.QueueUrl)) as string;

  await pause(2);

  await addQueuePolicy(queueArn, queueResponse.QueueUrl, ruleArn);

  await pause(2);
  await attachTargetToRule(targetId, eventBusName, ruleName, queueArn);
  await pause(2);
  return queueResponse;
};

export const deleteQueue = async (QueueUrl?: string) =>
  sendCommand(DeleteQueueCommand, { QueueUrl });
