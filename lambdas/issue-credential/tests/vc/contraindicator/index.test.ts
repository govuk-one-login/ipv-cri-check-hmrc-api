import { getHmrcContraIndicators } from "../../../src/vc/contraIndicator/index";
import { ContraIndicator } from "../../../src/vc/contraIndicator/ci-mapping-util";
import { CiMappings } from "../../../src/vc/contraIndicator/types/ci-mappings";
import { describe, expect, it } from "vitest";

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

describe("ci-mapping", () => {
  describe("getHmrcContraIndicators", () => {
    it("should return the mapped CI for a single matching hmrc_error in ContraIndicationMapping", () => {
      const event = {
        contraIndicationMapping,
        hmrcErrors: ["aaaa"],
        contraIndicatorReasonsMapping,
      } as CiMappings;

      const result = getHmrcContraIndicators(event);

      expect(result).toEqual([{ ci: "ci_1", reason: "ci_1 reason" }]);
    });

    it.each([[["bbbb"], [["cccc"]]]])(
      "should return contraIndicator code ci_2 and reason 'bbbb' for input '%s'",
      (input) => {
        const event = {
          contraIndicationMapping,
          hmrcErrors: input,
          contraIndicatorReasonsMapping,
        } as unknown as CiMappings;

        const result = getHmrcContraIndicators(event);

        expect(result).toEqual([{ ci: "ci_2", reason: "ci_2 reason" }]);
      }
    );

    it.each(testCases)(
      "should return all ContraIndicator code and reason pairs for hmrc errors input [%j]",
      (testCase: TestCase) => {
        const event = {
          contraIndicationMapping,
          hmrcErrors: testCase.inputHmrcErrors,
          contraIndicatorReasonsMapping,
        } as CiMappings;

        const result = getHmrcContraIndicators(event);

        expect(result).toEqual(testCase.expectedCIs);
      }
    );

    it("returns multiple ContraIndicator code and reasons when input contains different groups", () => {
      const event = {
        contraIndicationMapping,
        hmrcErrors: ["gggg,aaaa"],
        contraIndicatorReasonsMapping,
      } as CiMappings;

      const result = getHmrcContraIndicators(event);

      expect(result).toEqual([
        { ci: "ci_1", reason: "ci_1 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
      ]);
    });

    it("should not produce a CI if there are no hmrc_errors", () => {
      const event = {
        contraIndicationMapping,
        contraIndicatorReasonsMapping,
      } as CiMappings;

      const result = getHmrcContraIndicators(event);

      expect(result).toEqual([]);
    });

    it("throws error, not all items in hmrc_errors have matching ContraIndicationMapping", () => {
      const event = {
        contraIndicationMapping,
        hmrcErrors: ["aaaa", "not-a-mapped-error"],
        contraIndicatorReasonsMapping,
      } as CiMappings;

      expect(() => getHmrcContraIndicators(event)).toThrow(
        "Not all items in hmrc_errors have matching ContraIndicationMapping"
      );
    });
  });

  describe("getHmrcContraIndicators error handling", () => {
    it("should return empty array when HMRC_ERRORS_ABSENT", () => {
      const event = {
        contraIndicationMapping,
        contraIndicatorReasonsMapping,
      } as CiMappings;

      const result = getHmrcContraIndicators(event);

      expect(result).toEqual([]);
    });

    it("should log error when error occurs", () => {
      const event = {
        contraIndicationMapping,
        hmrcErrors: ["not-a-mapped-error"],
        contraIndicatorReasonsMapping,
      } as CiMappings;

      expect(() => getHmrcContraIndicators(event)).toThrow();
    });

    it("should rethrow error after logging", () => {
      const event = {
        contraIndicationMapping,
        hmrcErrors: ["not-a-mapped-error"],
        contraIndicatorReasonsMapping,
      } as CiMappings;

      expect(() => getHmrcContraIndicators(event)).toThrow("No matching hmrcError for any ContraIndicationMapping");
    });
  });
});
