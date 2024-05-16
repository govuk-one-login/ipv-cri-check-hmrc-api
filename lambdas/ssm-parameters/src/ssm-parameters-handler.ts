import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { Parameter } from "@aws-sdk/client-ssm";

const cacheTtlInSecond =
  Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;
const logger = new Logger();

export class SsmParametersHandler implements LambdaInterface {
  public async handler(
    event: { parameters: string[], govJourneyId: string },
    _context: unknown
  ): Promise<Parameter[]> {
    logger.info(`Lambda invoked with government journey id: ${event.govJourneyId}`);
    if (!Array.isArray(event.parameters)) {
      throw new Error("Input must be string array");
    }

    const { _errors: errors, ...parameters } =
      await getParametersByName<string>(
        Object.fromEntries(
          event.parameters.map((parameter) => [parameter, {}])
        ),
        { maxAge: cacheTtlInSecond, throwOnError: false }
      );

    if (errors?.length) {
      throw new Error(
        `Following SSM parameters do not exist: ${errors.join(", ")}`
      );
    }

    return event.parameters.map((name) => ({
      Name: name,
      Value: parameters[name],
    }));
  }
}

const handlerClass = new SsmParametersHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
