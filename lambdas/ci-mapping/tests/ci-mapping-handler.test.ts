import { CiMappingHandler } from "../src/ci-mapping-handler";
import { Context } from "aws-lambda";
import { CiMappingEvent } from "../src/ci-mapping-event-validator";

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
    "should return ci_2 for input '%s'",
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
      hmrc_errors: ["gggg,aaaa,gggg"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual(["ci_1", "ci_3"]);
  });

  it("should return multiple CIs when input contains different groups with spaces around hmrc errors", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: [" aaaa , gggg "],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual(["ci_1", "ci_3"]);
  });

  it("should return multiple CIs when input contains different groups with spaces CI mapping components", async () => {
    const event = {
      ci_mapping: [
        " aaaa:ci_1",
        "bbbb,cccc,dddd: ci_2",
        " eeee , ffff , gggg : ci_3 ",
      ],
      hmrc_errors: ["aaaa ,gggg"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual(["ci_1", "ci_3"]);
  });
  it("should not produce a CI if there are no hmrc_errors", async () => {
    const event = {
      ci_mapping: testCiMapping,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([]);
  });

  it("throws error, no matching hmrc_error for any ci_mapping", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["not-a-mapped-error"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    await expect(
      ciMappingHandler.handler(event, {} as Context)
    ).rejects.toThrow("No matching hmrc_error for any ci_mapping");
  });

  it("throws error, not all items in hmrc_errors have matching ci_mapping", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["aaaa", "not-a-mapped-error"],
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    await expect(
      ciMappingHandler.handler(event, {} as Context)
    ).rejects.toThrow("Not all items in hmrc_errors have matching ci_mapping");
  });
  describe("Given CI mapping format is Invalid", () => {
    it("throws error when entries that are colon separated with hmrc error key and without matching ci value", async () => {
      const event = {
        ci_mapping: ["aaaa:"],
        hmrc_errors: ["aaaa"],
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow("ci_mapping format is invalid");
    });
    it("throws error with ci entries that are colon separated and has a CI value without hmrc error key", async () => {
      const event = {
        ci_mapping: [":Ci_1"],
        hmrc_errors: [""],
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow("ci_mapping format is invalid");
    });
    it("throws error for ci entries containing anything other than colon separators", async () => {
      const event = {
        ci_mapping: ["aaaa,ci_1", "bbbb,cccc,dddd;ci_2", "eeee,ffff,gggg/ci_3"],
        hmrc_errors: ["aaaa"],
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow("ci_mapping format is invalid");
    });
    it.each([undefined, "", []])(
      "throws error, ci mapping is undefined, given %s as input",
      async (actual) => {
        const event = {
          ci_mapping: actual,
          hmrc_errors: ["aaaa"],
        } as unknown as CiMappingEvent;
        const ciMappingHandler = new CiMappingHandler();

        await expect(
          ciMappingHandler.handler(event, {} as Context)
        ).rejects.toThrow("ci_mapping cannot be undefined");
      }
    );
  });
});
