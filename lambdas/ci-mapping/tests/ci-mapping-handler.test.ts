import { CiMappingHandler } from "../src/ci-mapping-handler";
import { Context } from "aws-lambda";
import { CiMappingEvent } from "../src/ci-mapping-event-validator";
import { ContraIndicator } from "../src/utils/ci-mapping-util";
type TestCase = {
  inputHmrcErrors: string[];
  expectedCIs: ContraIndicator[];
};

const contraIndicationMapping = [
  '"An error description, with a comma", aaaa:ci_1',
  '"A second one with, a comma", bbbb,cccc,dddd:ci_2',
  '"Another error, description", eeee,ffff,gggg:ci_3',
];
const contraIndicatorReasonsMapping = [
  { ci: "ci_1", reason: "ci_1 reason" },
  { ci: "ci_2", reason: "ci_2 reason" },
  { ci: "ci_3", reason: "ci_3 reason" },
];
const testCases = [
  [
    {
      inputHmrcErrors: ["eeee", "ffff"],
      expectedCIs: [
        { ci: "ci_3", reason: "ci_3 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
      ],
    },
  ],
  [
    {
      inputHmrcErrors: ["eeee", "ffff", "gggg"],
      expectedCIs: [
        { ci: "ci_3", reason: "ci_3 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
      ],
    },
  ],
  [
    {
      inputHmrcErrors: ["eeee", "gggg"],
      expectedCIs: [
        { ci: "ci_3", reason: "ci_3 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
      ],
    },
  ],
  [
    {
      inputHmrcErrors: ['"An error description, with a comma"', "aaaa"],
      expectedCIs: [
        { ci: "ci_1", reason: "ci_1 reason" },
        { ci: "ci_1", reason: "ci_1 reason" },
        { ci: "ci_1", reason: "ci_1 reason" },
      ],
    },
  ],
];

describe("ci-mapping-handler", () => {
  it("should return the mapped CI for a single matching hmrc_error in ContraIndicationMapping", async () => {
    const event = {
      contraIndicationMapping,
      hmrcErrors: ["aaaa"],
      contraIndicatorReasonsMapping,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([{ ci: "ci_1", reason: "ci_1 reason" }]);
  });

  it.each([[["bbbb"], [["cccc"]]]])(
    "should return contraIndicator code ci_2 and reason 'bbbb' for input '%s'",
    async (input) => {
      const event = {
        contraIndicationMapping,
        hmrcErrors: input,
        contraIndicatorReasonsMapping,
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual([{ ci: "ci_2", reason: "ci_2 reason" }]);
    }
  );
  it.each(testCases)(
    "should return all ContraIndicator code and reason pairs for hmrc errors input [%j]",
    async (testCase: TestCase) => {
      const event = {
        contraIndicationMapping,
        hmrcErrors: testCase.inputHmrcErrors,
        contraIndicatorReasonsMapping,
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      const result = await ciMappingHandler.handler(event, {} as Context);

      expect(result).toEqual(testCase.expectedCIs);
    }
  );

  it("returns multiple ContraIndicator code and reasons when input contains different groups", async () => {
    const event = {
      contraIndicationMapping,
      hmrcErrors: ["gggg,aaaa"],
      contraIndicatorReasonsMapping,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([
      { ci: "ci_1", reason: "ci_1 reason" },
      { ci: "ci_3", reason: "ci_3 reason" },
    ]);
  });

  it("returns ContraIndicator code and reasons when input contains different groups with spaces around hmrc errors", async () => {
    const event = {
      contraIndicationMapping,
      hmrcErrors: [" aaaa , gggg "],
      contraIndicatorReasonsMapping,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([
      { ci: "ci_1", reason: "ci_1 reason" },
      { ci: "ci_3", reason: "ci_3 reason" },
    ]);
  });

  it("returns ContraIndicator code and reasons when input contains different groups with spaces CI mapping components", async () => {
    const event = {
      contraIndicationMapping: [
        " aaaa:ci_1",
        "bbbb,cccc,dddd: ci_2",
        " eeee , ffff , gggg : ci_3 ",
      ],
      hmrcErrors: ["aaaa ,gggg"],
      contraIndicatorReasonsMapping,
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
      contraIndicationMapping,
      contraIndicatorReasonsMapping,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    const result = await ciMappingHandler.handler(event, {} as Context);

    expect(result).toEqual([]);
  });

  it("throws error, no matching hmrc_error for any ContraIndicationMapping", async () => {
    const event = {
      contraIndicationMapping,
      hmrcErrors: ["not-a-mapped-error"],
      contraIndicatorReasonsMapping,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    await expect(
      ciMappingHandler.handler(event, {} as Context)
    ).rejects.toThrow("No matching hmrcError for any ContraIndicationMapping");
  });

  it("throws error, not all items in hmrc_errors have matching ContraIndicationMapping", async () => {
    const event = {
      contraIndicationMapping,
      hmrcErrors: ["aaaa", "not-a-mapped-error"],
      contraIndicatorReasonsMapping,
    } as CiMappingEvent;
    const ciMappingHandler = new CiMappingHandler();

    await expect(
      ciMappingHandler.handler(event, {} as Context)
    ).rejects.toThrow(
      "Not all items in hmrc_errors have matching ContraIndicationMapping"
    );
  });
  describe("Given CI mapping format is Invalid", () => {
    it("throws error when entries that are colon separated with hmrc error key and without matching ci value", async () => {
      const event = {
        contraIndicationMapping: ["aaaa:"],
        hmrcErrors: ["aaaa"],
        contraIndicatorReasonsMapping: [{ ci: "", reason: "" }],
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow("ContraIndicationMapping format is invalid");
    });
    it("throws error with ci entries that are colon separated and has a CI value without hmrc error key", async () => {
      const event = {
        contraIndicationMapping: [":Ci_1"],
        hmrcErrors: [""],
        contraIndicatorReasonsMapping,
      } as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow("ContraIndicationMapping format is invalid");
    });
    it("throws error for ci entries containing anything other than colon separators", async () => {
      const event = {
        contraIndicationMapping: [
          "aaaa,ci_1",
          "bbbb,cccc,dddd;ci_2",
          "eeee,ffff,gggg/ci_3",
        ],
        hmrcErrors: ["aaaa"],
        contraIndicatorReasonsMapping,
      } as unknown as CiMappingEvent;
      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow("ContraIndicationMapping format is invalid");
    });
    it.each([undefined, "", []])(
      "throws error, ci mapping is undefined, given %s as input",
      async (actual) => {
        const event = {
          ContraIndicationMapping: actual,
          hmrc_errors: ["aaaa"],
        } as unknown as CiMappingEvent;
        const ciMappingHandler = new CiMappingHandler();

        await expect(
          ciMappingHandler.handler(event, {} as Context)
        ).rejects.toThrow(
          "ContraIndicationMapping cannot be undefined in CiMappingEvent"
        );
      }
    );
  });
  describe("Given ContraIndication Mapping and ContraIndicator reason mapping are out of sync", () => {
    it("throws an error when ContraIndicationMapping is missing a CI", async () => {
      const contraIndicatorReasonsMapping = [
        { ci: "ci_1", reason: "ci_1 reason" },
        { ci: "ci_2", reason: "ci_2 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
      ];

      const testCiMappingWithMissingCi = ["aaaa:ci_1", "eeee,ffff,gggg:ci_3"];

      const event = {
        contraIndicationMapping: testCiMappingWithMissingCi,
        hmrcErrors: ["aaaa"],
        contraIndicatorReasonsMapping,
      } as CiMappingEvent;

      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow(
        "Unmatched ContraIndicatorReasonsMapping ci_2 detected"
      );
    });

    it("throws an error when ContraIndicatorReasonsMapping is missing a CI", async () => {
      const testCiReasons = [
        { ci: "ci_1", reason: "ci_1 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
      ];

      const testCiReasonsMappingWithMissingCi = [
        "aaaa:ci_1",
        "bbbb,cccc,dddd:ci_2",
        "eeee,ffff,gggg:ci_3",
      ];

      const event = {
        contraIndicationMapping: testCiReasonsMappingWithMissingCi,
        hmrcErrors: ["aaaa"],
        contraIndicatorReasonsMapping: testCiReasons,
      } as CiMappingEvent;

      const ciMappingHandler = new CiMappingHandler();

      await expect(
        ciMappingHandler.handler(event, {} as Context)
      ).rejects.toThrow("Unmatched ContraIndicationMappings ci_2 detected");
    });
  });
});
