import * as SSMPowerToolsParameter from "@aws-lambda-powertools/parameters/ssm";
import * as GetParameters from "../../src/util/get-parameters";
jest.mock("@aws-lambda-powertools/parameters/ssm");

describe("getParametersValues", () => {
  const issuer = "mock-issuer";
  const audience = "my-audience";
  it("returns parameter values when getParametersByName resolves successfully", async () => {
    const mockParameterPaths = [
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience",
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer",
    ];

    const mockParameters = {
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience": audience,
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer": issuer,
    };

    jest.spyOn(SSMPowerToolsParameter, "getParametersByName").mockResolvedValueOnce({
      ...mockParameters,
      _errors: [],
    });

    const result = await GetParameters.getParametersValues(mockParameterPaths);

    expect(SSMPowerToolsParameter.getParametersByName).toHaveBeenCalledWith(
      Object.fromEntries(mockParameterPaths.map((path) => [path, {}])),
      { maxAge: 300, throwOnError: false }
    );
    expect(result).toEqual({
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience": audience,
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer": issuer,
    });
  });
  it("returns parameter values when calling getParametersByName ttl override and resolves successfully", async () => {
    const mockParameterPaths = [
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience",
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer",
    ];

    const mockParameters = {
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience": audience,
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer": issuer,
    };

    jest.spyOn(SSMPowerToolsParameter, "getParametersByName").mockResolvedValueOnce({
      ...mockParameters,
      _errors: [],
    });

    const result = await GetParameters.getParametersValues(mockParameterPaths, 500);

    expect(SSMPowerToolsParameter.getParametersByName).toHaveBeenCalledWith(
      Object.fromEntries(mockParameterPaths.map((path) => [path, {}])),
      { maxAge: 500, throwOnError: false }
    );
    expect(result).toEqual({
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience": "my-audience",
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer": "mock-issuer",
    });
  });

  it("throws an error when getParametersByName returns errors", async () => {
    const mockParameterPaths = [
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience",
      "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer",
    ];

    jest.spyOn(SSMPowerToolsParameter, "getParametersByName").mockResolvedValueOnce({
      _errors: ["/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience"],
    });

    await expect(GetParameters.getParametersValues(mockParameterPaths)).rejects.toThrow(
      "Following SSM parameters do not exist: /mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience"
    );
  });
});
