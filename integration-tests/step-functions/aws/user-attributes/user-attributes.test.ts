import { stackOutputs } from "../../../resources/cloudformation-helper";
import { executeStepFunction } from "../../../resources/stepfunction-helper";

describe("user-attributes", () => {
  let output: Partial<{
    UserAttributesStateMachineArn: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
  });

  describe("run with no input", () => {
    it("returns empty object {}", async () => {
      const startExecutionResult = await executeStepFunction(
        output.UserAttributesStateMachineArn as string
      );

      const result = JSON.parse(startExecutionResult.output || "");

      expect(result).toEqual({});
    });
  });

  describe("run with a single userInfo component as input", () => {
    it("should transform nino input value into a userAttributes with a socialSecurityRecord", async () => {
      const startExecutionResult = await executeStepFunction(
        output.UserAttributesStateMachineArn as string,
        {
          nino: "AA000003D",
        }
      );

      const result = JSON.parse(startExecutionResult.output || "");

      expect(result).toEqual({
        socialSecurityRecord: [{ personalNumber: "AA000003D" }],
      });
    });
    it("should transform userInfo with birthDates into a userAttributes with an array of birthDate value objects", async () => {
      const startExecutionResult = await executeStepFunction(
        output.UserAttributesStateMachineArn as string,
        {
          userInfoEvent: {
            Items: [
              {
                birthDates: {
                  L: [
                    {
                      M: {
                        value: {
                          S: "1948-04-23",
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        }
      );

      const result = JSON.parse(startExecutionResult.output || "");

      expect(result).toEqual({
        birthDate: [
          {
            value: "1948-04-23",
          },
        ],
      });
    });
  });

  describe("run with a single userInfo component as input", () => {
    it("should transform nino input value into a userAttributes with a socialSecurityRecord", async () => {
      const startExecutionResult = await executeStepFunction(
        output.UserAttributesStateMachineArn as string,
        {
          nino: "AA000003D",
        }
      );

      const result = JSON.parse(startExecutionResult.output || "");

      expect(result).toEqual({
        socialSecurityRecord: [{ personalNumber: "AA000003D" }],
      });
    });
    it("should transform userInfo with birthDates into a userAttributes with an array of birthDate value objects", async () => {
      const startExecutionResult = await executeStepFunction(
        output.UserAttributesStateMachineArn as string,
        {
          userInfoEvent: {
            Items: [
              {
                birthDates: {
                  L: [
                    {
                      M: {
                        value: {
                          S: "1948-04-23",
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        }
      );

      const result = JSON.parse(startExecutionResult.output || "");

      expect(result).toEqual({
        birthDate: [
          {
            value: "1948-04-23",
          },
        ],
      });
    });
  });

  describe("run with a multiple userInfo components as input", () => {
    const input = {
      nino: "AA000003D",
      userInfoEvent: {
        Count: 1,
        Items: [
          {
            names: {
              L: [
                {
                  M: {
                    nameParts: {
                      L: [
                        {
                          M: {
                            type: {
                              S: "GivenName",
                            },
                            value: {
                              S: "Alice",
                            },
                          },
                        },
                        {
                          M: {
                            type: {
                              S: "GivenName",
                            },
                            value: {
                              S: "Jane",
                            },
                          },
                        },
                        {
                          M: {
                            type: {
                              S: "FamilyName",
                            },
                            value: {
                              S: "Doe",
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
            birthDates: {
              L: [
                {
                  M: {
                    value: {
                      S: "1948-04-23",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };
    it("should transform userInfo with birthDates into a userAttributes with an array of birthDate value objects", async () => {
      const startExecutionResult = await executeStepFunction(
        output.UserAttributesStateMachineArn as string,
        input
      );

      const result = JSON.parse(startExecutionResult.output || "");

      expect(result).toEqual({
        name: [
          {
            nameParts: [
              {
                type: "GivenName",
                value: "Alice",
              },
              {
                type: "GivenName",
                value: "Jane",
              },
              {
                type: "FamilyName",
                value: "Doe",
              },
            ],
          },
        ],
        birthDate: [
          {
            value: "1948-04-23",
          },
        ],
        socialSecurityRecord: [{ personalNumber: "AA000003D" }],
      });
    });
  });
});
