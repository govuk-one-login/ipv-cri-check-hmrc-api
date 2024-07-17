import {
  ListStateMachinesCommand,
  ListTagsForResourceCommand,
  StartSyncExecutionCommand,
  SFNClient,
} from "@aws-sdk/client-sfn";

import { ServiceInputTypes, ServiceOutputTypes } from "@aws-sdk/lib-dynamodb";
import { Command } from "@aws-sdk/types";
import { Client, SmithyResolvedConfiguration } from "@smithy/smithy-client";
import { HttpHandlerOptions } from "@smithy/types";

const sendCommand = createSendCommand(
  () =>
    new SFNClient({
      region: process.env.AWS_REGION,
    })
);

export const executeStepFunction = async (
  stateMachineArn: string,
  input: Record<string, unknown> = {}
) =>
  sendCommand(StartSyncExecutionCommand, {
    stateMachineArn,
    input: JSON.stringify(input),
  });

export const listStateMachine = async () =>
  sendCommand(ListStateMachinesCommand, {});

export const listTags = async (stateMachineArn: string) =>
  sendCommand(ListTagsForResourceCommand, {
    resourceArn: stateMachineArn,
  });

type AWSServiceClient<
  Input extends ServiceInputTypes,
  Output extends ServiceOutputTypes,
> = Client<
  HttpHandlerOptions,
  Input,
  Output,
  SmithyResolvedConfiguration<HttpHandlerOptions>
>;

type AWSServiceClientCommand<
  Input extends ServiceInputTypes,
  InputType extends Input,
  Output extends ServiceOutputTypes,
  OutputType extends Output,
> = Command<
  Input,
  InputType,
  Output,
  OutputType,
  SmithyResolvedConfiguration<HttpHandlerOptions>
>;

export function createSendCommandWithClient<
  Input extends ServiceInputTypes,
  InputType extends Input,
  Output extends ServiceOutputTypes,
  OutputType extends Output,
>(client: AWSServiceClient<Input, Output>) {
  return function <
    CommandInputType extends Input = InputType,
    CommandOutputType extends Output = OutputType,
  >(
    commandConstructor: new (
      input: CommandInputType
    ) => AWSServiceClientCommand<
      Input,
      CommandInputType,
      Output,
      CommandOutputType
    >,
    commandInput: CommandInputType
  ) {
    return client.send(new commandConstructor(commandInput));
  };
}

export function createSendCommand<
  Input extends ServiceInputTypes,
  Output extends ServiceOutputTypes,
>(clientConstructor: () => SFNClient) {
  return createSendCommandWithClient(clientConstructor());
}
