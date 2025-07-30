import express from "express";
import asyncify from "express-asyncify";
import { Logger } from "@aws-lambda-powertools/logger";
import { stackOutputs } from "../../../resources/cloudformation-helper";
import { environment } from "../../env-variables";
import { formatJwtForPactTest } from "../utils/PactJwtFormatter";
import { IncomingHttpHeaders } from "http";

const logger = new Logger({
  logLevel: "DEBUG",
  serviceName: "CredentialIssueRouter",
});

let publicAPI: string;

export const credentialIssueRouter = asyncify(express.Router());
credentialIssueRouter.post("/", async (req, res) => {
  logger.debug(`Recieved Request - Type: ${req.method}`);

  const passedThroughHeaders = convertExpressHeadersToFetchHeaders(req.headers);

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

  const responseBody = await response.text();
  logger.debug(`/credential/issue Response body: ${responseBody}`);

  const body = response.status === 200 ? formatJwtForPactTest(responseBody) : responseBody;

  logger.debug(`formatJwtForPactTest: ${body}`);

  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }
  res.status(response.status);
  res.send(body);
});

const convertExpressHeadersToFetchHeaders = (incomingHeaders: IncomingHttpHeaders) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (key !== "transfer-encoding") {
      headers.append(key, value as string);
    }
  }
  return headers;
};
