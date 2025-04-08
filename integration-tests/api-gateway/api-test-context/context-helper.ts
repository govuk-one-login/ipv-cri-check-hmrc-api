import { stackOutputs } from "../../resources/cloudformation-helper";
import { getSSMParametersValues } from "../../resources/ssm-param-helper";

type SetupIntegrationContextResult = {
  outputs?: Record<string, string>;
  ssmParams?: Record<string, string>;
};

export const setupIntegrationContext = async (
  ssmParameterPaths: string[] = []
): Promise<SetupIntegrationContextResult> => {
  const outputs = await stackOutputs(process.env.STACK_NAME);

  let ssmParams: Record<string, string> | undefined;

  if (ssmParameterPaths.length > 0) {
    ssmParams = await getSSMParametersValues(...ssmParameterPaths);
  }

  return {
    outputs,
    ssmParams,
  };
};
