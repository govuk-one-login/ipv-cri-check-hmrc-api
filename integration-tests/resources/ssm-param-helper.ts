import {
  DeleteParameterCommand,
  GetParameterCommand,
  GetParametersCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { createSendCommand } from "./aws-helper";

const sendCommand = createSendCommand(
  () => new SSMClient({ region: "eu-west-2" })
);

export const getSSMParametersValues = async (
  ...parameterNames: string[]
): Promise<Record<string, string>> => {
  const response = await sendCommand(GetParametersCommand, {
    Names: parameterNames,
  });

  const result: Record<string, string> = {};

  response.Parameters?.forEach((param) => {
    if (param.Name && param.Value) {
      result[param.Name] = param.Value;
    }
  });

  return result;
};

export const getSSMParameter = (name: string) =>
  sendCommand(GetParameterCommand, { Name: name }).then(
    (result) => result.Parameter?.Value
  );

export const deleteSSMParameter = (name: string) =>
  sendCommand(DeleteParameterCommand, { Name: name });

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
