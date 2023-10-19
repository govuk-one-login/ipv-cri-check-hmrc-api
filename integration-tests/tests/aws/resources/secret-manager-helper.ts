import * as AWS from "aws-sdk";

AWS.config.update({ region: process.env.AWS_REGION });

const secretsManager = new AWS.SecretsManager();

export const getSecretParamValue = async (params: any) => {
  return await secretsManager.getSecretValue(params).promise();
};

export const secretManagerUpdate = async (params: any) => {
  return await secretsManager.putSecretValue(params).promise();
};
