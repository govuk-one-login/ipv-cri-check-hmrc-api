import {
  CiReasonsMapping,
  validateInputs,
} from "../src/ci-mapping-event-validator";
import { CiMappingEvent } from "../src/ci-mapping-event";

describe("ci-mapping-event-validator", () => {
  describe("validateInputs", () => {
    const contraIndicationMapping = [
      "aaaa:ci_1",
      "bbbb,cccc,dddd:ci_2",
      "eeee,ffff,gggg:ci_3",
    ];
    const contraIndicatorReasonsMapping = [
      { ci: "ci_1", reason: "ci_1 reason" },
      { ci: "ci_2", reason: "ci_2 reason" },
      { ci: "ci_3", reason: "ci_3 reason" },
    ];
    const govJourneyId = "test-government-journey-id";
    it("should return successfully when CiMappingEvent is valid", () => {
      expect(
        validateInputs({
          contraIndicationMapping,
          hmrcErrors: ["aaaa"],
          contraIndicatorReasonsMapping,
        } as CiMappingEvent)
      ).toEqual({
        contraIndicationMapping,
        hmrcErrors: ["aaaa"],
        contraIndicatorReasonsMapping,
      });
    });

    it("throws error, no matching hmrc_error for any ContraIndicationMapping", () => {
      expect(() =>
        validateInputs({
          contraIndicationMapping,
          hmrcErrors: ["not-a-mapped-error"],
          contraIndicatorReasonsMapping,
        } as CiMappingEvent)
      ).toThrow("No matching hmrcError for any ContraIndicationMapping");
    });

    it("throws an error, not all items in hmrc_errors have matching ContraIndicationMapping", () => {
      expect(() =>
        validateInputs({
          contraIndicationMapping,
          hmrcErrors: ["aaaa", "not-a-mapped-error"],
          contraIndicatorReasonsMapping,
        } as CiMappingEvent)
      ).toThrow(
        "Not all items in hmrc_errors have matching ContraIndicationMapping"
      );
    });

    describe("CiMappingEvent has an empty, blank or undefined component", () => {
      it("throws error, ContraIndicationMapping cannot be undefined given CiMappingEvent is an empty object", () => {
        expect(() => validateInputs({} as CiMappingEvent)).toThrow(
          "ContraIndicationMapping cannot be undefined in CiMappingEvent"
        );
      });

      it("throws ContraIndicationMapping cannot be undefined, given both ContraIndicationMapping, contraIndicatorReasonsMapping and hmrc errors array are empty", () => {
        expect(() =>
          validateInputs({
            contraIndicationMapping: [],
            hmrcErrors: [],
            contraIndicatorReasonsMapping: [],
          } as unknown as CiMappingEvent)
        ).toThrow(
          "ContraIndicationMapping cannot be undefined in CiMappingEvent"
        );
      });

      it.each([undefined, [], ""])(
        "throws hmrc errors absent in CiMappingEvent given only hmrc errors array is %s and valid ContraIndicationMapping and contraIndicatorReasonsMapping",
        (actual) => {
          expect(() =>
            validateInputs({
              contraIndicationMapping,
              hmrcErrors: actual as unknown as string[],
              contraIndicatorReasonsMapping,
              govJourneyId,
            })
          ).toThrow("Hmrc errors absent in CiMappingEvent");
        }
      );

      it.each([undefined, [], ""])(
        "throws ContraIndicationMapping cannot be undefined, given valid hmrc error and ContraIndicationMapping is %s",
        (actual) => {
          expect(() =>
            validateInputs({
              contraIndicationMapping: actual as unknown as string[],
              hmrcErrors: ["aaaa"],
              contraIndicatorReasonsMapping: [
                { ci: "aaaa", reason: undefined as unknown as string },
              ],
              govJourneyId,
            })
          ).toThrow(
            "ContraIndicationMapping cannot be undefined in CiMappingEvent"
          );
        }
      );

      it.each([undefined, [], ""])(
        "throws ContraIndicatorReasonsMapping cannot be undefined, given valid hmrc error and ContraIndicatorReasonsMapping is %s",
        (actual) => {
          expect(() =>
            validateInputs({
              contraIndicationMapping,
              hmrcErrors: ["aaaa"],
              contraIndicatorReasonsMapping:
                actual as unknown as CiReasonsMapping[],
            } as CiMappingEvent)
          ).toThrow(
            "ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent"
          );
        }
      );
    });

    describe("Given ContraIndicationMapping format is invalid", () => {
      it("throws error when ci entries that are colon separated are without hmrc error key but with a CI value", async () => {
        expect(() =>
          validateInputs({
            contraIndicationMapping: [":Ci_1"],
            hmrcErrors: [""],
            contraIndicatorReasonsMapping: [{ ci: "Ci_1" } as CiReasonsMapping],
          } as CiMappingEvent)
        ).toThrow("ContraIndicationMapping format is invalid");
      });

      it("throws error with ci entries that are colon separated with a hmrc error key but without a CI value", async () => {
        expect(() =>
          validateInputs({
            contraIndicationMapping: ["err1:"],
            hmrcErrors: [""],
            contraIndicatorReasonsMapping: [{ ci: "" } as CiReasonsMapping],
          } as CiMappingEvent)
        ).toThrow("ContraIndicationMapping format is invalid");
      });

      it("throws error given ci entries that are not colon separated", async () => {
        expect(() =>
          validateInputs({
            contraIndicationMapping: [
              "aaaa,ci_1",
              "bbbb,cccc,dddd;ci_2",
              "eeee,ffff,gggg/ci_3",
            ],
            hmrcErrors: ["aaaa"],
            contraIndicatorReasonsMapping: [
              {
                ci: "",
                reason: "",
              },
            ],
          } as CiMappingEvent)
        ).toThrow("ContraIndicationMapping format is invalid");
      });
    });

    describe("Given ContraIndication Mapping and ContraIndicator reason mapping are out of sync", () => {
      it("throws an unmatched error when ContraIndicationMapping is missing a CI", () => {
        const contraIndicationMappingMissingCi_3 = [
          "aaaa:ci_1",
          "bbbb,cccc,dddd:ci_2",
        ];
        expect(() =>
          validateInputs({
            contraIndicationMapping: contraIndicationMappingMissingCi_3,
            hmrcErrors: ["aaaa"],
            contraIndicatorReasonsMapping,
          } as CiMappingEvent)
        ).toThrow(
          "Unmatched ContraIndicatorReasonsMapping ci_3 detected in configured mappings"
        );
      });

      it("throws an unmatched error when ContraIndicationMapping is missing multiple CIs", () => {
        const contraIndicationMappingMissingCis = ["aaaa:ci_1"];
        expect(() =>
          validateInputs({
            contraIndicationMapping: contraIndicationMappingMissingCis,
            hmrcErrors: ["aaaa"],
            contraIndicatorReasonsMapping,
          } as CiMappingEvent)
        ).toThrow(
          "Unmatched ContraIndicatorReasonsMapping ci_2,ci_3 detected in configured mappings"
        );
      });

      it("throws a different undefined error when all ContraIndicatorReasonsMapping is missing", () => {
        const contraIndicationMappingMissingCi_3 = ["aaaa:ci_1"];
        const validatedResult = () =>
          validateInputs({
            contraIndicationMapping: contraIndicationMappingMissingCi_3,
            hmrcErrors: ["aaaa"],
            contraIndicatorReasonsMapping: [],
          } as unknown as CiMappingEvent);
        expect(() => validatedResult()).not.toThrow(
          "Unmatched ContraIndicatorReasonsMapping ci_2,ci_3 detected in configured mappings"
        );
        expect(() => validatedResult()).toThrow(
          "ContraIndicatorReasonsMapping cannot be undefined in CiMappingEvent"
        );
      });

      it("throws an unmatched error when ContraIndicatorReasonsMapping is missing multiple CI", () => {
        const contraIndicatorReasonsMappingMissingCis = [
          { ci: "ci_2", reason: "ci_2 reason" },
        ];
        expect(() =>
          validateInputs({
            contraIndicationMapping,
            hmrcErrors: ["aaaa"],
            contraIndicatorReasonsMapping:
              contraIndicatorReasonsMappingMissingCis,
          } as CiMappingEvent)
        ).toThrow(
          "Unmatched ContraIndicationMappings ci_1,ci_3 detected in configured mappings"
        );
      });

      it("throws an unmatched error when ContraIndicatorReasonsMapping is missing multiple CIs", () => {
        const contraIndicatorReasonsMappingMissingCi_1 = [
          { ci: "ci_2", reason: "ci_2 reason" },
          { ci: "ci_3", reason: "ci_3 reason" },
        ];
        expect(() =>
          validateInputs({
            contraIndicationMapping,
            hmrcErrors: ["aaaa"],
            contraIndicatorReasonsMapping:
              contraIndicatorReasonsMappingMissingCi_1,
          } as CiMappingEvent)
        ).toThrow(
          "Unmatched ContraIndicationMappings ci_1 detected in configured mappings"
        );
      });
    });
  });
});
