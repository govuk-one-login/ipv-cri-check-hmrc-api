import { describe, expect, it, vi } from "vitest";
import { mockLogger } from "../../../../common/tests/logger";
vi.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
import { getHmrcContraIndicators } from "../../../src/vc/contraIndicator/index";
import { CiMappingEntry } from "../../../src/vc/contraIndicator/types";

const ciMapping: CiMappingEntry[] = [
  { mappedHmrcErrors: ["An error description", "with a comma", "aaaa"], ciValue: "ci_1" },
  { mappedHmrcErrors: ["A second one with", "a comma", "bbbb", "cccc", "dddd"], ciValue: "ci_2" },
  { mappedHmrcErrors: ["Another error", "description", "eeee", "ffff", "gggg"], ciValue: "ci_3" },
];

const reasonsMapping = [
  { ci: "ci_1", reason: "ci_1 reason" },
  { ci: "ci_2", reason: "ci_2 reason" },
  { ci: "ci_3", reason: "ci_3 reason" },
];
const mappings = { ciMapping, reasonsMapping };

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
      inputHmrcErrors: ["An error description, with a comma", "aaaa"],
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
      const result = getHmrcContraIndicators(mappings, ["aaaa"]);

      expect(result).toEqual([{ ci: "ci_1", reason: "ci_1 reason" }]);
    });

    it.each([[["bbbb"], [["cccc"]]]])(
      "should return contraIndicator code ci_2 and reason 'bbbb' for input '%s'",
      (input) => {
        const result = getHmrcContraIndicators(mappings, input);

        expect(result).toEqual([{ ci: "ci_2", reason: "ci_2 reason" }]);
      }
    );

    it.each(testCases)(
      "should return all ContraIndicator code and reason pairs for hmrc errors input [%j]",
      (testCase) => {
        const result = getHmrcContraIndicators(mappings, testCase.inputHmrcErrors);

        expect(result).toEqual(testCase.expectedCIs);
      }
    );

    it("returns multiple ContraIndicator code and reasons when input contains different groups", () => {
      const result = getHmrcContraIndicators(mappings, ["gggg,aaaa"]);

      expect(result).toEqual([
        { ci: "ci_1", reason: "ci_1 reason" },
        { ci: "ci_3", reason: "ci_3 reason" },
      ]);
    });

    it("should not produce a CI if there are no hmrc_errors", () => {
      const result = getHmrcContraIndicators(mappings, undefined as unknown as string[]);

      expect(result).toEqual([]);
    });

    it("throws error, not all items in hmrc_errors have matching ContraIndicationMapping", () => {
      expect(() => getHmrcContraIndicators(mappings, ["aaaa", "not-a-mapped-error"])).toThrow(
        "Not all items in hmrc_errors have matching ContraIndicationMapping"
      );
    });
  });

  describe("getHmrcContraIndicators error handling", () => {
    it("should log error when error occurs", () => {
      expect(() => getHmrcContraIndicators(mappings, ["not-a-mapped-error"])).toThrow();
    });

    it("should rethrow error after logging", () => {
      expect(() => getHmrcContraIndicators(mappings, ["not-a-mapped-error"])).toThrow(
        "No matching hmrcError for any ContraIndicationMapping"
      );
    });
  });
});
