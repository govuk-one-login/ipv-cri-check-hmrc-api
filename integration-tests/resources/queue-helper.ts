import {
  CreateQueueCommand,
  CreateQueueCommandOutput,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  QueueAttributeName,
  ReceiveMessageCommand,
  SQSClient,
  SetQueueAttributesCommand,
  DeleteMessageBatchCommand,
  DeleteMessageBatchRequestEntry,
  Message,
} from "@aws-sdk/client-sqs";
import { createSendCommand } from "./aws-helper";
import { RetryConfig, pause, retry } from "./util";
import { attachTargetToRule } from "./event-bridge-helper";

export const targetId = `queue-target-id${Date.now()}`;

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
});

const sendCommand = createSendCommand(() => sqsClient);

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
        Sid: `sqs-Allow-eventBridge-to-sendMessage-${Date.now()}`,
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

export const getQueueMessages = (
  queueUrl: string,
  retryConfig: RetryConfig
) => {
  return retry(retryConfig, async () => {
    const { Messages } = await sendCommand(ReceiveMessageCommand, {
      QueueUrl: queueUrl,
      WaitTimeSeconds: 20,
    });
    if (!Messages || Messages.length === 0) {
      throw new Error("No messages received.");
    }

    return Messages;
  });
};

export const setUpQueueAndAttachToRule = async (
  ruleArn: string,
  ruleName: string,
  eventBusName: string
) => {
  const queueResponse: CreateQueueCommandOutput = await createQueue(
    `event-bus-test-Queue-${Date.now()}`
  );
  const queueArn = (await getQueueArn(queueResponse.QueueUrl)) as string;

  await pause(15);

  await addQueuePolicy(queueArn, queueResponse.QueueUrl, ruleArn);

  await pause(15);
  await attachTargetToRule(targetId, eventBusName, ruleName, queueArn);
  await pause(15);
  return queueResponse;
};

export const deleteQueue = async (QueueUrl?: string) =>
  sendCommand(DeleteQueueCommand, { QueueUrl });

export const getMessageBatch = async (
  QueueUrl?: string
): Promise<Message[] | undefined> => {
  const recieveInput = {
    QueueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
    VisibilityTimeout: 20,
  };

  const receiveCommand = new ReceiveMessageCommand(recieveInput);
  const { Messages } = await sqsClient.send(receiveCommand);
  return Messages;
};

export const deleteMessageBatch = async (
  QueueUrl: string,
  eventsToDelete: Message[]
) => {
  const itemsToDelete = eventsToDelete.reduce<DeleteMessageBatchRequestEntry[]>(
    (acc, { MessageId, ReceiptHandle }) => {
      if (MessageId && ReceiptHandle) {
        const obj = {
          Id: MessageId,
          ReceiptHandle,
        } as DeleteMessageBatchRequestEntry;
        acc.push(obj);
      }
      return acc;
    },
    []
  );

  const deleteInput = {
    QueueUrl,
    Entries: itemsToDelete,
  };
  const deleteCommand = new DeleteMessageBatchCommand(deleteInput);
  await sqsClient.send(deleteCommand);
};
