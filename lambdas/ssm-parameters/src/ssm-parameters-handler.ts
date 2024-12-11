import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { Parameter } from "@aws-sdk/client-ssm";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";

const cacheTtlInSecond =
  Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;

export class SsmParametersHandler implements LambdaInterface {
  public async handler(
    event: { parameters: string[]; govJourneyId: string },
    context: Context
  ): Promise<Parameter[]> {
    const logHelper = new LogHelper(context);
    logHelper.logEntry(context.functionName, event.govJourneyId);

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
      const errorMessage = `Following SSM parameters do not exist: ${errors.join(
        ", "
      )}`;
      logHelper.logError(
        context.functionName,
        event.govJourneyId,
        errorMessage
      );
      throw new Error(errorMessage);
    }

    return event.parameters.map((name) => ({
      Name: name,
      Value: parameters[name],
    }));
  }
}

const handlerClass = new SsmParametersHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
