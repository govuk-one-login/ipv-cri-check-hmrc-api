import { SsmParametersHandler } from "../src/ssm-parameters-handler";
import { Context } from "aws-lambda";
import { jest } from "@jest/globals";
import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";

describe("ssm-parameters-handler", () => {
  const ssmParametersHandler = new SsmParametersHandler();
  const ssmProvider = jest.mocked(SSMProvider).prototype;
  jest.spyOn(ssmProvider, "getParametersByName").mockResolvedValue({});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return list with 1 object when given list of 1 SSM parameter", async () => {
    const parameters = {
      ssmTestName: "ssmTestNameReturn",
      _errors: [],
    };
    ssmProvider.getParametersByName.mockResolvedValueOnce(parameters);

    const result = await ssmParametersHandler.handler(
      ["ssmTestName"],
      {} as Context
    );

    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual([
      {
        Name: "ssmTestName",
        Value: "ssmTestNameReturn",
      },
    ]);
  });

  it("should return empty list when given an empty list", async () => {
    const parameters = {
      _errors: [],
    };
    ssmProvider.getParametersByName.mockResolvedValueOnce(parameters);

    const result = await ssmParametersHandler.handler([], {} as Context);

    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual([]);
  });

  it("should throw error when given bad SSM parameter", async () => {
    jest
      .spyOn(SSMProvider.prototype, "getParametersByName")
      .mockImplementation((parameters) =>
        Promise.resolve({ _errors: Object.keys(parameters) })
      );

    await expect(
      ssmParametersHandler.handler(["BadParameter"], {} as Context)
    ).rejects.toThrow(
      new Error("Following SSM parameters do not exist: BadParameter")
    );
    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(1);
  });

  it("should throw error when given multiple bad SSM parameter", async () => {
    jest
      .spyOn(SSMProvider.prototype, "getParametersByName")
      .mockImplementation((parameters) =>
        Promise.resolve({ _errors: Object.keys(parameters) })
      );

    await expect(
      ssmParametersHandler.handler(
        ["BadParameter", "SecondBadParameter"],
        {} as Context
      )
    ).rejects.toThrow(
      new Error(
        "Following SSM parameters do not exist: BadParameter, SecondBadParameter"
      )
    );
    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(1);
  });

  it("should throw error when given good SSM parameter and a bad SSM parameter", async () => {
    jest
      .spyOn(SSMProvider.prototype, "getParametersByName")
      .mockImplementation((parameters) =>
        Promise.resolve({ _errors: ["BadParameter"] })
      );

    await expect(
      ssmParametersHandler.handler(
        ["GoodParameter", "BadParameter"],
        {} as Context
      )
    ).rejects.toThrow(
      new Error("Following SSM parameters do not exist: BadParameter")
    );
    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(1);
  });

  it("should throw error when not given an array", async () => {
    await expect(
      ssmParametersHandler.handler({} as string[], {} as Context)
    ).rejects.toThrow(new Error("Input must be string array"));
    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(0);
  });
});
