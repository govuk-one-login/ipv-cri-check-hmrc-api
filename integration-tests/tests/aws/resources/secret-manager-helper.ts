import * as AWS from "aws-sdk";

AWS.config.update({ region: process.env.AWS_REGION });

const secretsManager = new AWS.SecretsManager();

export const getSecretParamValue = async (
  params: AWS.SecretsManager.GetSecretValueRequest
) => {
  return await secretsManager.getSecretValue(params).promise();
};

export const secretManagerUpdate = async (
  params: AWS.SecretsManager.GetSecretValueRequest
) => {
  return await secretsManager.putSecretValue(params).promise();
};
