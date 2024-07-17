import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { executeStepFunction } from "./utils/stepfunction-helper";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const logger = new Logger();

const ssmClient = new SSMClient({ region: "eu-west-2" });
const ssmParamName = process.env.ssmParameterName;

export class APIGWProxyHandler implements LambdaInterface {
  private stateMachineCache: { [path: string]: string | undefined } = {};

  public async handler(
    event: any,
    _context: unknown,
    callback: any
  ): Promise<unknown> {
    try {
      logger.info("Entry APIGWProxyHandler#handler");

      const { path, headers, body, queryStringParameters } = event;

      const parsedBody = this.parseBody(headers["Content-Type"], body);

      headers.Cookie = headers.Cookie
        ? JSON.parse(cookieStringToJson(headers.Cookie))
        : undefined;
      if (headers.Cookie == undefined) {
        headers.Cookie = headers.cookie
          ? JSON.parse(cookieStringToJson(headers.cookie))
          : undefined;
      }

      this.logRequestDetails(event, path, headers, body);

      let stateMachineArn = this.stateMachineCache[path];
      if (!stateMachineArn) {
        logger.info(
          "State machine ARN for " + path + " not cached, querying..."
        );
        stateMachineArn = await this.findStateMachineArn(path);
        logger.info(
          "Cached state machine ARN: " + stateMachineArn + " for path " + path
        );
        this.stateMachineCache[path] = stateMachineArn;
      }

      if (!stateMachineArn) {
        logger.info(`No state machine found for ${path}`);
        return callback(
          null,
          this.createResponse(404, { message: "Resource not found" })
        );
      }

      logger.info(`Executing state machine ${stateMachineArn}`);

      const execution = await executeStepFunction(stateMachineArn, {
        headers,
        queryStringParameters,
        body: parsedBody,
      });

      const output = JSON.parse(execution.output || "");
      logger.info(`State machine output ${JSON.stringify(output)}`);

      logger.info("Exit APIGWProxyHandler#handler");
      return callback(
        null,
        this.createResponse(output.httpStatus, output.body, output.headers)
      );
    } catch (error: any) {
      logger.error(`Failure occurred: ${error.message}`);
      return callback(
        null,
        this.createResponse(500, { error: "Internal server error" })
      );
    }
  }

  private parseBody(contentType: string | undefined, body: string): any {
    logger.info("Parsing request body");
    if (!contentType) return body?.length > 0 ? JSON.parse(body) : body;

    if (contentType.toLowerCase() === "application/x-www-form-urlencoded") {
      return JSON.parse(formUrlEncodedToJson(body));
    }

    return body?.length > 0 ? JSON.parse(body) : body;
  }

  private logRequestDetails(
    event: unknown,
    path: string,
    headers: unknown,
    body: string
  ): void {
    logger.info(JSON.stringify(event));
    logger.info(`Entry ${path}`);
    logger.info(`Request headers ${JSON.stringify(headers)}`);
    logger.info(`Request body ${body}`);
  }

  private async findStateMachineArn(path: string): Promise<string | undefined> {
    logger.info("Entry findStateMachineArn");
    logger.info("Reading SSM parameter");

    const command = new GetParameterCommand({ Name: ssmParamName });
    const response = await ssmClient.send(command);
    const value = response.Parameter?.Value;
    logger.info("Value in SSM " + value);

    if (!value) {
      return undefined;
    }

    const json = JSON.parse(value);
    if (!json[path]) {
      logger.info(path + " not found in SSM parameter");
      return undefined;
    }

    logger.info("Exit findStateMachineArn");
    return json[path];
  }

  private createResponse(
    statusCode: number,
    body: any,
    headers: any = {}
  ): {
    statusCode: number;
    body: string;
    headers: any;
  } {
    return {
      statusCode,
      headers,
      body: JSON.stringify(body || {}),
    };
  }
}

function formUrlEncodedToJson(formUrlEncoded: string): string {
  const pairs = formUrlEncoded.split("&");
  const result = pairs.reduce((acc: Record<string, unknown>, pair) => {
    const [key, value] = pair.split("=");
    acc[decodeURIComponent(key)] = decodeURIComponent(value);
    return acc;
  }, {});
  return JSON.stringify(result);
}

function cookieStringToJson(cookieString: string): string {
  const pairs = cookieString.split("; ");
  const result = pairs.reduce((acc: Record<string, unknown>, pair) => {
    const [key, value] = pair.split("=");
    acc[decodeURIComponent(key.trim())] = decodeURIComponent(value.trim());
    return acc;
  }, {});
  return JSON.stringify(result);
}

const handlerClass = new APIGWProxyHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
