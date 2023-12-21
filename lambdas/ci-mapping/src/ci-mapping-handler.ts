import { LambdaInterface } from "@aws-lambda-powertools/commons";

export class CiMappingHandler implements LambdaInterface {
  public async handler(_event: unknown, _context: unknown): Promise<string> {
    return "Hello, World!";
  }
}

const handlerClass = new CiMappingHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
