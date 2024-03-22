import { LambdaInterface } from "@aws-lambda-powertools/commons";

export class CurrentTimeHandler implements LambdaInterface {
  public async handler(_event: unknown, _context: unknown): Promise<Object> {
    const currentTime = Date.now()

    return {
      milliseconds: currentTime,
      seconds: Math.floor(currentTime / 1000)
    }
  }
}

const handlerClass = new CurrentTimeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
