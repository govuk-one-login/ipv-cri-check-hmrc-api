import { CiMappingHandler } from "../src/ci-mapping-handler";
import { Context } from "aws-lambda";
import { CiMappingEvent } from "../src/ci-mapping-event-validator";
import { ContraIndicator } from "../src/utils/ci-mapping-util";
type TestCase = {
  inputHmrcErrors: string[];
  expectedCIs: ContraIndicator[];
};

const testCiMapping = [
  "aaaa:ci_1",
  "bbbb,cccc,dddd:ci_2",
  "eeee,ffff,gggg:ci_3",
];
const testCiReasons = [
  { ci: "ci_1", reason: "ci_1 reason" },
  { ci: "ci_2", reason: "ci_2 reason" },
  { ci: "ci_3", reason: "ci_3 reason" },
];

const testCases = [
  [
    {
      inputHmrcErrors: ["eeee", "ffff"],
      expectedCIs: [{ ci: "ci_3", reason: "ci_3 reason" }],
    },
  ],
  [
    {
      inputHmrcErrors: ["eeee", "ffff", "gggg"],
      expectedCIs: [{ ci: "ci_3", reason: "ci_3 reason" }],
    },
  ],
  [
    {
      inputHmrcErrors: ["eeee", "gggg"],
      expectedCIs: [{ ci: "ci_3", reason: "ci_3 reason" }],
    },
  ],
];

describe("ci-mapping-handler", () => {
  it("should return the mapped CI for a single matching hmrc_error in ci_mapping", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["aaaa"],
      ci_reason_mapping: testCiReasons,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([{ ci: "ci_1", reason: "ci_1 reason" }]);
  });

  it.each([[["bbbb"], [["cccc"]]]])(
    "should return contraIndicator code ci_2 and reason 'bbbb' for input '%s'",
    async (input) => {
      const event = {
        ci_mapping: testCiMapping,
        hmrc_errors: input,
        ci_reason_mapping: testCiReasons,
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual([{ ci: "ci_2", reason: "ci_2 reason" }]);
    }
  );

  it.each(testCases)(
    "should return unique ContraIndicator code and reason pairs for hmrc errors input [%j]",
    async (testCase: TestCase) => {
      const event = {
        ci_mapping: testCiMapping,
        hmrc_errors: testCase.inputHmrcErrors,
        ci_reason_mapping: testCiReasons,
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual(testCase.expectedCIs);
    }
  );

  it("returns multiple unique ContraIndicator code and reasons when input contains different groups", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: ["gggg,aaaa,gggg"],
      ci_reason_mapping: testCiReasons,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([
      { ci: "ci_1", reason: "ci_1 reason" },
      { ci: "ci_3", reason: "ci_3 reason" },
    ]);
  });

  it("returns unique ContraIndicator code and reasons when input contains different groups with spaces around hmrc errors", async () => {
    const event = {
      ci_mapping: testCiMapping,
      hmrc_errors: [" aaaa , gggg "],
      ci_reason_mapping: testCiReasons,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([
      { ci: "ci_1", reason: "ci_1 reason" },
      { ci: "ci_3", reason: "ci_3 reason" },
    ]);
  });

  it("returns unique ContraIndicator code and reasons when input contains different groups with spaces CI mapping components", async () => {
    const event = {
      ci_mapping: [
        " aaaa:ci_1",
        "bbbb,cccc,dddd: ci_2",
        " eeee , ffff , gggg : ci_3 ",
      ],
      hmrc_errors: ["aaaa ,gggg"],
      ci_reason_mapping: testCiReasons,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([
      { ci: "ci_1", reason: "ci_1 reason" },
      { ci: "ci_3", reason: "ci_3 reason" },
    ]);
  });
  it("should not produce a CI if there are no hmrc_errors", async () => {
    const event = {
      ci_mapping: testCiMapping,
      ci_reason_mapping: testCiReasons,
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
