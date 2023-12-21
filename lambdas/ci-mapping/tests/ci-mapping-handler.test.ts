import { CiMappingHandler } from "../src/ci-mapping-handler";
import { Context } from "aws-lambda";
import { CiMappingEvent } from "../src/ci-mapping-event";

const testCiMapping = [
  "aaaa:ci_1",
  "bbbb,cccc,dddd:ci_2",
  "eeee,ffff,gggg:ci_3",
];

describe("ci-mapping-handler", () => {
  it("should return the correct CI for a given input", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["aaaa"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual(["ci_1"]);
  });

  it.each([["bbbb"], ["cccc"]])(
    "should return correct CI value",
    async ([input]) => {
      const event = {
        ci_mapping: testCiMapping,
        hmrc_errors: [input],
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual(["ci_2"]);
    }
  );

  it.each([
    [
      "eeee",
      ["eeee", "ffff"],
      ["eeee", "ffff", "gggg"],
      ["ffff"],
      ["gggg"],
      ["eeee", "gggg"],
    ],
  ])(
    "should return correct CI value in the same group for when errors",
    async ([input]) => {
      const event = {
        ci_mapping: testCiMapping,
        hmrc_errors: [input],
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual(["ci_3"]);
    }
  );

  it("should return multiple CIs when they are different", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["aaaa,gggg"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual(["ci_1", "ci_3"]);
  });
});
