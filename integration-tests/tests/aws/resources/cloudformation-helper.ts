import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import { createSendCommand } from "./aws-helper";

export type StackInfo = Awaited<ReturnType<typeof describeStack>>;

type Outputs = Partial<{
  NinoAttemptsTable: string;
  NinoUsersTable: string;
  NinoCheckStateMachineArn: string;
  CheckSessionStateMachineArn: string;
  NinoIssueCredentialStateMachineArn: string;
}>;

const sendCommand = createSendCommand(
  () =>
    new CloudFormationClient({
      region: process.env.AWS_REGION,
    })
);

export const stackOutputs = (stackName?: string): Promise<Outputs> =>
  sendCommand(DescribeStacksCommand, { StackName: stackName }).then((results) =>
    Object.fromEntries(
      results.Stacks?.at(0)?.Outputs?.map((output) => [
        output.OutputKey,
        output.OutputValue,
      ]) || []
    )
  );

export const stackParameters = (stackName?: string) =>
  sendCommand(DescribeStacksCommand, { StackName: stackName }).then((results) =>
    Object.fromEntries(
      results.Stacks?.at(0)?.Parameters?.map((parameter) => [
        parameter.ParameterKey,
        parameter.ParameterValue,
      ]) || []
    )
  );

export const getStackParameter = (
  stackName: string | undefined,
  parameterName: string
) => stackParameters(stackName).then((parameters) => parameters[parameterName]);

export async function describeStack() {
  const stackName = process.env.STACK_NAME;
  const [commonStackName, outputs] = await Promise.all([
    getStackParameter(stackName, "CommonStackName"),
    stackOutputs(stackName),
  ]);

  return {
    sessionTableName: `session-${commonStackName}`,
    personIdentityTableName: `person-identity-${commonStackName}`,
    verifiableCredentialKmsSigningKeyId: `/${commonStackName}/verifiableCredentialKmsSigningKeyId`,
    outputs: outputs,
  };
}
