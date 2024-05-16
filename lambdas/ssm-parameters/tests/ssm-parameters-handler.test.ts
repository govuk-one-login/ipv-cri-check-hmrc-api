import { SsmParametersHandler } from "../src/ssm-parameters-handler";
import { Context } from "aws-lambda";
import { jest } from "@jest/globals";
import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";

const mockGovernmentJourneyId = "test-government-journey-id";

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
      {
        parameters: ["ssmTestName"],
        govJourneyId: mockGovernmentJourneyId
      },
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

    const result = await ssmParametersHandler.handler(
      { parameters: [], govJourneyId: mockGovernmentJourneyId },
      {} as Context
    );

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
      ssmParametersHandler.handler(
        {
          parameters: ["BadParameter"],
          govJourneyId: mockGovernmentJourneyId
        },
        {} as Context
      )
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
        { parameters: ["BadParameter", "SecondBadParameter"],
        govJourneyId: mockGovernmentJourneyId },
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
      .mockImplementation(() => Promise.resolve({ _errors: ["BadParameter"] }));

    await expect(
      ssmParametersHandler.handler(
        { parameters: ["GoodParameter", "BadParameter"],
        govJourneyId: mockGovernmentJourneyId },
        {} as Context
      )
    ).rejects.toThrow(
      new Error("Following SSM parameters do not exist: BadParameter")
    );
    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(1);
  });

  it("should throw error when not given an array", async () => {
    await expect(
      ssmParametersHandler.handler(
        { parameters: "hello", govJourneyId: mockGovernmentJourneyId } as never,
        {} as Context
      )
    ).rejects.toThrow(new Error("Input must be string array"));
    expect(ssmProvider.getParametersByName).toHaveBeenCalledTimes(0);
  });
});
