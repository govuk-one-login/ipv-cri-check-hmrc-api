import { describe, expect, it } from "vitest";
import { CiMappingEntry, ContraIndicator } from "../../../src/vc/contraIndicator/types";
import { parseCIMappings, validateHmrcErrors } from "../../../src/vc/contraIndicator/ci-mappings-validator";

describe("ci-mapping-validator", () => {
  const ciMapping: CiMappingEntry[] = [
    { mappedHmrcErrors: ["aaaa"], ciValue: "ci_1" },
    { mappedHmrcErrors: ["bbbb", "cccc", "dddd"], ciValue: "ci_2" },
    { mappedHmrcErrors: ["eeee", "ffff", "gggg"], ciValue: "ci_3" },
  ];

  const reasonsMapping: ContraIndicator[] = [
    { ci: "ci_1", reason: "ci_1 reason" },
    { ci: "ci_2", reason: "ci_2 reason" },
    { ci: "ci_3", reason: "ci_3 reason" },
  ];

  const ciMappingInput =
    "An error description, with a comma, aaaa:ci_1||A second one with, a comma, bbbb,cccc,dddd:ci_2||Another error, description, eeee,ffff,gggg:ci_3";

  const reasonsMappingInput = JSON.stringify(reasonsMapping);

  describe("parseCiMappings", () => {
    describe("Invalid input cases", () => {
      it("throws the expected error when both mapping inputs are undefined", () => {
        expect(() => parseCIMappings(undefined as unknown as string, undefined as unknown as string)).toThrow(
          "ContraIndicationMapping cannot be undefined in CiMappingEvent"
        );
      });

      it.each([undefined, [], ""])(
        "throws 'ContraIndicationMapping cannot be undefined' when CI mapping is %s and reasons mapping is valid",
        (actual) => {
          expect(() => parseCIMappings(actual as unknown as string, reasonsMappingInput)).toThrow(
            "ContraIndicationMapping cannot be undefined in CiMappingEvent"
          );
        }
      );

      it.each([undefined, [], ""])(
        "throws 'ContraIndicatorReasonsMapping cannot be undefined' when reasonsMapping is %s and CI mapping is valid",
        (actual) => {
          expect(() => parseCIMappings(ciMappingInput, actual as unknown as string)).toThrow(
            "ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent"
          );
        }
      );
    });

    describe("Invalid formatting of mapping configs retrieved from SSM", () => {
      it("throws an error when CI mappings are missing HMRC errors", async () => {
        expect(() => parseCIMappings(":Ci_1", JSON.stringify([{ ci: "Ci_1" }]))).toThrow(
          "ContraIndicationMapping format is invalid"
        );
      });

      it("throws an error when CI mappings are missing a CI value", async () => {
        expect(() => parseCIMappings("err1:", JSON.stringify([{ ci: "" }]))).toThrow(
          "ContraIndicationMapping format is invalid"
        );
      });

      it("throws an error when CI mapping entries are not colon separated", async () => {
        expect(() =>
          parseCIMappings(
            "aaaa,ci_1||bbbb,cccc,dddd;ci_2||eeee,ffff,gggg/ci_3",
            JSON.stringify([
              {
                ci: "",
                reason: "",
              },
            ])
          )
        ).toThrow("ContraIndicationMapping format is invalid");
      });
    });

    describe("When CI mapping and reasons mapping are out of sync", () => {
      it("throws an unmatched error when CI mapping is missing a CI", () => {
        const contraIndicationMappingMissingCi_3 = "aaaa:ci_1||bbbb,cccc,dddd:ci_2";
        expect(() => parseCIMappings(contraIndicationMappingMissingCi_3, reasonsMappingInput)).toThrow(
          "Unmatched ContraIndicatorReasonsMapping ci_3 detected in configured mappings"
        );
      });

      it("throws an unmatched error when CI mapping is missing multiple CIs", () => {
        const contraIndicationMappingMissingCis = "aaaa:ci_1";
        expect(() => parseCIMappings(contraIndicationMappingMissingCis, reasonsMappingInput)).toThrow(
          "Unmatched ContraIndicatorReasonsMapping ci_2,ci_3 detected in configured mappings"
        );
      });

      it("throws a different unmatched error when CI mapping is missing all CIs", () => {
        const contraIndicationMappingMissingCi_3 = "aaaa:ci_1";
        const validatedResult = () => parseCIMappings(contraIndicationMappingMissingCi_3, "");
        expect(validatedResult).not.toThrow(
          "Unmatched ContraIndicatorReasonsMapping ci_2,ci_3 detected in configured mappings"
        );
        expect(validatedResult).toThrow("ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent");
      });

      it("throws an unmatched error when reasons mapping is missing multiple CIs", () => {
        const contraIndicatorReasonsMappingMissingCis = JSON.stringify([{ ci: "ci_2", reason: "ci_2 reason" }]);
        expect(() => parseCIMappings(ciMappingInput, contraIndicatorReasonsMappingMissingCis)).toThrow(
          "Unmatched ContraIndicationMappings ci_1,ci_3 detected in configured mappings"
        );
      });

      it("throws an unmatched error when reasons mapping is missing a single CI", () => {
        const contraIndicatorReasonsMappingMissingCi_1 = JSON.stringify([
          { ci: "ci_2", reason: "ci_2 reason" },
          { ci: "ci_3", reason: "ci_3 reason" },
        ]);
        expect(() => parseCIMappings(ciMappingInput, contraIndicatorReasonsMappingMissingCi_1)).toThrow(
          "Unmatched ContraIndicationMappings ci_1 detected in configured mappings"
        );
      });
    });
  });

  describe("validateHmrcErrors", () => {
    it("should return successfully when input is valid", () => {
      expect(validateHmrcErrors(ciMapping, ["aaaa"])).toEqual(["aaaa"]);
    });

    it("throws an error when given only an HMRC error that is not present in the mappings", () => {
      expect(() => validateHmrcErrors(ciMapping, ["not-a-mapped-error"])).toThrow(
        "No matching hmrcError for any ContraIndicationMapping"
      );
    });

    it("throws an error when not all HMRC errors are present in the CI mappings", () => {
      expect(() => validateHmrcErrors(ciMapping, ["aaaa", "not-a-mapped-error"])).toThrow(
        "Not all items in hmrc_errors have matching ContraIndicationMapping"
      );
    });
  });
});
