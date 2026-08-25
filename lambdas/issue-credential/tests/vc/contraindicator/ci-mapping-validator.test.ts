import { describe, expect, it } from "vitest";
import { CiMappings, ContraIndicator } from "../../../src/vc/contraIndicator/types";
import { validateInputs } from "../../../src/vc/contraIndicator/ci-mappings-validator";

describe("ci-mapping-validator", () => {
  describe("validateInputs", () => {
    const contraIndicationMapping = ["aaaa:ci_1", "bbbb,cccc,dddd:ci_2", "eeee,ffff,gggg:ci_3"];
    const contraIndicatorReasonsMapping = [
      { ci: "ci_1", reason: "ci_1 reason" },
      { ci: "ci_2", reason: "ci_2 reason" },
      { ci: "ci_3", reason: "ci_3 reason" },
    ];

    const mappings = { contraIndicationMapping, contraIndicatorReasonsMapping };

    const validCiMapping = [
      { mappedHmrcErrors: ["aaaa"], ciValue: "ci_1" },
      { mappedHmrcErrors: ["bbbb", "cccc", "dddd"], ciValue: "ci_2" },
      { mappedHmrcErrors: ["eeee", "ffff", "gggg"], ciValue: "ci_3" },
    ];

    it("should return successfully when CiMappingEvent is valid", () => {
      expect(validateInputs(mappings, ["aaaa"])).toEqual({
        contraIndicationMapping: validCiMapping,
        extractedHmrcErrors: ["aaaa"],
        contraIndicatorReasonsMapping: contraIndicatorReasonsMapping,
      });
    });

    it("throws error, no matching hmrc_error for any ContraIndicationMapping", () => {
      expect(() => validateInputs(mappings, ["not-a-mapped-error"])).toThrow(
        "No matching hmrcError for any ContraIndicationMapping"
      );
    });

    it("throws an error, not all items in hmrc_errors have matching ContraIndicationMapping", () => {
      expect(() => validateInputs(mappings, ["aaaa", "not-a-mapped-error"])).toThrow(
        "Not all items in hmrc_errors have matching ContraIndicationMapping"
      );
    });

    describe("CiMappingEvent has an empty, blank or undefined component", () => {
      it("throws error, ContraIndicationMapping cannot be undefined given CiMappingEvent is an empty object", () => {
        expect(() => validateInputs({} as CiMappings, undefined as unknown as string[])).toThrow(
          "ContraIndicationMapping cannot be undefined in CiMappingEvent"
        );
      });

      it("throws ContraIndicationMapping cannot be undefined, given both ContraIndicationMapping, contraIndicatorReasonsMapping and hmrc errors array are empty", () => {
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping: [],
              contraIndicatorReasonsMapping: [],
            },
            []
          )
        ).toThrow("ContraIndicationMapping cannot be undefined in CiMappingEvent");
      });

      it.each([undefined, [], ""])(
        "throws ContraIndicationMapping cannot be undefined, given valid hmrc error and ContraIndicationMapping is %s",
        (actual) => {
          expect(() =>
            validateInputs(
              {
                contraIndicationMapping: actual as unknown as string[],
                contraIndicatorReasonsMapping: [{ ci: "aaaa", reason: undefined as unknown as string }],
              },
              ["aaaa"]
            )
          ).toThrow("ContraIndicationMapping cannot be undefined in CiMappingEvent");
        }
      );

      it.each([undefined, [], ""])(
        "throws ContraIndicatorReasonsMapping cannot be undefined, given valid hmrc error and ContraIndicatorReasonsMapping is %s",
        (actual) => {
          expect(() =>
            validateInputs(
              {
                contraIndicationMapping,
                contraIndicatorReasonsMapping: actual as unknown as ContraIndicator[],
              } as CiMappings,
              ["aaaa"]
            )
          ).toThrow("ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent");
        }
      );
    });

    describe("Given ContraIndicationMapping format is invalid", () => {
      it("throws error when ci entries that are colon separated are without hmrc error key but with a CI value", async () => {
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping: [":Ci_1"],
              contraIndicatorReasonsMapping: [{ ci: "Ci_1" } as ContraIndicator],
            },
            [""]
          )
        ).toThrow("ContraIndicationMapping format is invalid");
      });

      it("throws error with ci entries that are colon separated with a hmrc error key but without a CI value", async () => {
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping: ["err1:"],
              contraIndicatorReasonsMapping: [{ ci: "" } as ContraIndicator],
            },
            [""]
          )
        ).toThrow("ContraIndicationMapping format is invalid");
      });

      it("throws error given ci entries that are not colon separated", async () => {
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping: ["aaaa,ci_1", "bbbb,cccc,dddd;ci_2", "eeee,ffff,gggg/ci_3"],
              contraIndicatorReasonsMapping: [
                {
                  ci: "",
                  reason: "",
                },
              ],
            },
            ["aaaa"]
          )
        ).toThrow("ContraIndicationMapping format is invalid");
      });
    });

    describe("Given ContraIndication Mapping and ContraIndicator reason mapping are out of sync", () => {
      it("throws an unmatched error when ContraIndicationMapping is missing a CI", () => {
        const contraIndicationMappingMissingCi_3 = ["aaaa:ci_1", "bbbb,cccc,dddd:ci_2"];
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping: contraIndicationMappingMissingCi_3,
              contraIndicatorReasonsMapping,
            },
            ["aaaa"]
          )
        ).toThrow("Unmatched ContraIndicatorReasonsMapping ci_3 detected in configured mappings");
      });

      it("throws an unmatched error when ContraIndicationMapping is missing multiple CIs", () => {
        const contraIndicationMappingMissingCis = ["aaaa:ci_1"];
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping: contraIndicationMappingMissingCis,
              contraIndicatorReasonsMapping,
            },
            ["aaaa"]
          )
        ).toThrow("Unmatched ContraIndicatorReasonsMapping ci_2,ci_3 detected in configured mappings");
      });

      it("throws a different undefined error when all ContraIndicatorReasonsMapping is missing", () => {
        const contraIndicationMappingMissingCi_3 = ["aaaa:ci_1"];
        const validatedResult = () =>
          validateInputs(
            {
              contraIndicationMapping: contraIndicationMappingMissingCi_3,
              contraIndicatorReasonsMapping: [],
            },
            ["aaaa"]
          );
        expect(validatedResult).not.toThrow(
          "Unmatched ContraIndicatorReasonsMapping ci_2,ci_3 detected in configured mappings"
        );
        expect(validatedResult).toThrow("ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent");
      });

      it("throws an unmatched error when ContraIndicatorReasonsMapping is missing multiple CI", () => {
        const contraIndicatorReasonsMappingMissingCis = [{ ci: "ci_2", reason: "ci_2 reason" }];
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping,
              contraIndicatorReasonsMapping: contraIndicatorReasonsMappingMissingCis,
            },
            ["aaaa"]
          )
        ).toThrow("Unmatched ContraIndicationMappings ci_1,ci_3 detected in configured mappings");
      });

      it("throws an unmatched error when ContraIndicatorReasonsMapping is missing multiple CIs", () => {
        const contraIndicatorReasonsMappingMissingCi_1 = [
          { ci: "ci_2", reason: "ci_2 reason" },
          { ci: "ci_3", reason: "ci_3 reason" },
        ];
        expect(() =>
          validateInputs(
            {
              contraIndicationMapping,
              contraIndicatorReasonsMapping: contraIndicatorReasonsMappingMissingCi_1,
            },
            ["aaaa"]
          )
        ).toThrow("Unmatched ContraIndicationMappings ci_1 detected in configured mappings");
      });
    });
  });
});
