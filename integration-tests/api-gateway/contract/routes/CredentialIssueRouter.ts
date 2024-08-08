import express from "express";
import asyncify from "express-asyncify";
import { Logger } from "@aws-lambda-powertools/logger";
import { base64url, decodeJwt } from "jose";
import { stackOutputs } from "../../../resources/cloudformation-helper";
import { environment } from "../../env-variables";

const logger = new Logger({
  logLevel: "DEBUG",
  serviceName: "CredentialIssueRouter",
});

let publicAPI: string;

export const credentialIssueRouter = asyncify(express.Router());
credentialIssueRouter.post("/", async (req, res) => {
  logger.debug(`Recieved Request - Type: ${req.method}`);

  const passedThroughHeaders = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key !== "transfer-encoding") {
      passedThroughHeaders.append(key, value as string);
    }
  }

  if (!publicAPI) {
    const preOutput = await stackOutputs(process.env.STACK_NAME);
    publicAPI = `${preOutput.PublicApiGatewayId}`;
  }

  const response = await fetch(
    `https://${publicAPI}.execute-api.eu-west-2.amazonaws.com/${environment}/credential/issue`,
    {
      method: req.method,
      headers: passedThroughHeaders,
    }
  );

  const result: string = await ammendJwt(response);

  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }
  res.status(response.status);
  res.send(result);
});

const ammendJwt = async (response: Response) => {
  if (response.status !== 200) {
    return "";
  }
  const decodedVc = decodeJwt(await response.text());
  const stringifyVc = JSON.stringify(decodedVc);
  const parseVc = JSON.parse(stringifyVc);
  parseVc.nbf = 4070908800;
  parseVc.iss = "dummyNinoComponentId";
  parseVc.exp = 4070909400;
  parseVc.jti = "dummyJti";
  const reorderedJson = {
    sub: parseVc.sub,
    nbf: parseVc.nbf,
    iss: parseVc.iss,
    exp: parseVc.exp,
    vc: parseVc.vc,
    type: parseVc.type,
    context: parseVc["@context"],
    jti: parseVc.jti,
  };

  const jwtHeader = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.";
  return jwtHeader + base64url.encode(JSON.stringify(reorderedJson)) + ".";
};
