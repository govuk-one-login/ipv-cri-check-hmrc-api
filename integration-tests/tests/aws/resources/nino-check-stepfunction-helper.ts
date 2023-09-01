import { SFNClient, StartSyncExecutionCommand } from "@aws-sdk/client-sfn";

const sfnClient = new SFNClient({
  region: process.env.AWS_DEFAULT_REGION,
});
export const executeStepFunction = async (input: Record<string, unknown>) => {
  return await sfnClient.send(
    new StartSyncExecutionCommand({
      stateMachineArn: process.env.STATE_MACHINE_ARN as string,
      input: JSON.stringify(input),
    })
  );
};
