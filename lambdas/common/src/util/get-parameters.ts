import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";

/**
 * Retrieves parameter values from SSM using the full parameter paths.
 * Returns an object where the keys are the full parameter paths and the values are the parameter values.
 */
export const getParametersValues = async (
  parameterPaths: string[],
  cacheTtlInSeconds = 300
): Promise<Record<string, string>> => {
  const { _errors: errors, ...parameters } = await getParametersByName<string>(
    Object.fromEntries(parameterPaths.map((path) => [path, {}])),
    { maxAge: cacheTtlInSeconds, throwOnError: false }
  );

  if (errors?.length) {
    const errorMessage = `Following SSM parameters do not exist: ${errors.join(", ")}`;
    throw new Error(errorMessage);
  }

  return Object.fromEntries(
    parameterPaths.map((path) => {
      // Always use the full path as the key instead of extracting the last part
      return [path, String(parameters[path])];
    })
  );
};
