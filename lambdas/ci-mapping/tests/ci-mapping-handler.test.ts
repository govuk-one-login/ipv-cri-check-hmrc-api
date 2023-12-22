import { CiMappingHandler } from "../src/ci-mapping-handler";
import { Context } from "aws-lambda";
import { CiMappingEvent } from "../src/ci-mapping-event";

const testCiMapping = [
  "aaaa:ci_1",
  "bbbb,cccc,dddd:ci_2",
  "eeee,ffff,gggg:ci_3",
];

describe("ci-mapping-handler", () => {
  it("should return the mapped CI for a single matching hmrc_error in ci_mapping", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["aaaa"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual(["ci_1"]);
  });

  it.each([[["bbbb"], [["cccc"]]]])(
    "should not return ci_2 for input '%s'",
    async (input) => {
      const event = {
        ci_mapping: testCiMapping,
        hmrc_errors: input,
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual(["ci_2"]);
    }
  );

  it.each([[["eeee", "ffff"]], [["eeee", "ffff", "gggg"]], [["eeee", "gggg"]]])(
    "should not return duplicate CIs for input [%s]",
    async (input) => {
      const event = {
        ci_mapping: testCiMapping,
        hmrc_errors: input,
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual(["ci_3"]);
    }
  );

  it("should return multiple CIs when input contains different groups", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["aaaa,gggg"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual(["ci_1", "ci_3"]);
  });

  it("should not produce a CI if there are no hmrc_errors", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: [],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([]);
  });

  it("should throw an error when no matching hmrc_error for any ci_mapping", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["not-a-mapped-error"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    await expect(
      ciMappingHandler.handler(event, {} as Context)
    ).rejects.toThrowError("No matching hmrc_error for any ci_mapping");
  });

  it("should throw an error when not all items in hmrc_errors have matching ci_mapping", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["not-a-mapped-error", "aaaa"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    await expect(
      ciMappingHandler.handler(event, {} as Context)
    ).rejects.toThrowError(
      "Not all items in hmrc_errors have matching ci_mapping"
    );
  });
});
