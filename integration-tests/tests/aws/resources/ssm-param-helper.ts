import {
  GetParameterCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { createSendCommand } from "./aws-helper";

const sendCommand = createSendCommand(() => new SSMClient());

export const getSSMParameter = (name: string) =>
  sendCommand(GetParameterCommand, { Name: name }).then(
    (result) => result.Parameter?.Value
  );

export const getSSMParameters = (...names: string[]) =>
  Promise.all(names.map((name) => getSSMParameter(name)));

export const updateSSMParameter = (name: string, value: string) =>
  sendCommand(PutParameterCommand, {
    Name: name,
    Value: value,
    Type: "String",
    Overwrite: true,
  });

export const updateSSMParameters = (
  ...params: { name: string; value: string }[]
) =>
  Promise.all(
    params.map((param) => updateSSMParameter(param.name, param.value))
  );
