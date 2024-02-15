import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { Parameter } from "@aws-sdk/client-ssm";

const CACHE_TTL_IN_SECONDS =
  Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;

export class SsmParametersHandler implements LambdaInterface {
  public async handler(
    event: string[],
    _context: unknown
  ): Promise<Parameter[]> {
    if (!Array.isArray(event)) {
      throw new Error("Input must be string array");
    }

    const { _errors: errors, ...parameters } =
      await getParametersByName<string>(
        Object.fromEntries(event.map((parameter) => [parameter, {}])),
        { maxAge: CACHE_TTL_IN_SECONDS, throwOnError: false }
      );

    if (errors?.length) {
      throw new Error(
        `Following SSM parameters do not exist: ${errors.join(", ")}`
      );
    }

    return Object.entries(parameters).map(([name, value]) => ({
      Name: name,
      Value: value,
    }));
  }
}

const handlerClass = new SsmParametersHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
