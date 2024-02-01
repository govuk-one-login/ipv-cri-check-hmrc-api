import {
  PurgeQueueCommand,
  ReceiveMessageCommand,
  ReceiveMessageCommandOutput,
  SQSClient,
} from "@aws-sdk/client-sqs";

const sqsClient: SQSClient = new SQSClient({ region: process.env.AWS_REGION });

export async function getMessagesFromQueue(
  queueUrl: string,
  numberOfMessages: number = 10,
  timeoutSeconds: number = 20
) {
  const receiveMessageCommand = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: numberOfMessages,
    WaitTimeSeconds: timeoutSeconds,
  });

  const result: ReceiveMessageCommandOutput = await sqsClient.send(
    receiveMessageCommand
  );

  return (result.Messages || []).map((message) => message.Body!);
}

export async function clearSQSQueue(queueUrl: string) {
  await sqsClient.send(
    new PurgeQueueCommand({
      QueueUrl: queueUrl,
    })
  );
}
