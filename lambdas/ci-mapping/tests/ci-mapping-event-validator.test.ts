import {
  CiMappingEvent,
  validateInputs,
} from "../src/ci-mapping-event-validator";

describe("ci-mapping-event-validator", () => {
  describe("validateInputs", () => {
    const ci_mapping = [
      "aaaa:ci_1",
      "bbbb,cccc,dddd:ci_2",
      "eeee,ffff,gggg:ci_3",
    ];
    it("should return successfully when CiMappingEvent is valid", () => {
      expect(
        validateInputs({
          ci_mapping,
          hmrc_errors: ["aaaa"],
        })
      ).toEqual({
        ci_mappings: ci_mapping,
        hmrc_errors: ["aaaa"],
      });
    });

    it("throws error, no matching hmrc_error for any ci_mapping", () => {
      expect(() =>
        validateInputs({
          ci_mapping,
          hmrc_errors: ["not-a-mapped-error"],
        })
      ).toThrow("No matching hmrc_error for any ci_mapping");
    });

    it("throws an error, not all items in hmrc_errors have matching ci_mapping", () => {
      expect(() =>
        validateInputs({
          ci_mapping,
          hmrc_errors: ["aaaa", "not-a-mapped-error"],
        })
      ).toThrow("Not all items in hmrc_errors have matching ci_mapping");
    });

    describe("CiMappingEvent has an empty, blank or undefined component", () => {
      it("throws error, ci_mapping cannot be undefined given CiMappingEvent is an empty object", () => {
        expect(() => validateInputs({} as CiMappingEvent)).toThrow(
          "ci_mapping cannot be undefined"
        );
      });

      it("throws ci_mapping cannot be undefined, given both ci_mapping and hmrc errors array are empty", () => {
        expect(() =>
          validateInputs({
            ci_mapping: [],
            hmrc_errors: [],
          })
        ).toThrow("ci_mapping cannot be undefined");
      });

      it.each([undefined, [], ""])(
        "throws hmrc errors absent in CiMappingEvent given only hmrc errors array is %s and a valid ci_mapping",
        (actual) => {
          expect(() =>
            validateInputs({
              ci_mapping,
              hmrc_errors: actual as unknown as string[],
            })
          ).toThrow("Hmrc errors absent in CiMappingEvent");
        }
      );

      it.each([undefined, [], ""])(
        "throws ci_mapping cannot be undefined, given valid hmrc error and ci_mapping is %s",
        (actual) => {
          expect(() =>
            validateInputs({
              ci_mapping: actual as unknown as string[],
              hmrc_errors: ["aaaa"],
            })
          ).toThrow("ci_mapping cannot be undefined");
        }
      );
    });

    describe("Given ci_mapping format is invalid", () => {
      it("throws error when ci entries that are colon separated are without hmrc error key but with a CI value", async () => {
        expect(() =>
          validateInputs({
            ci_mapping: [":Ci_1"],
            hmrc_errors: [""],
          })
        ).toThrow("ci_mapping format is invalid");
      });

      it("throws error with ci entries that are colon separated with a hmrc error key but without a CI value", async () => {
        expect(() =>
          validateInputs({
            ci_mapping: ["err1:"],
            hmrc_errors: [""],
          })
        ).toThrow("ci_mapping format is invalid");
      });

      it("throws error given ci entries that are not colon separated", async () => {
        expect(() =>
          validateInputs({
            ci_mapping: [
              "aaaa,ci_1",
              "bbbb,cccc,dddd;ci_2",
              "eeee,ffff,gggg/ci_3",
            ],
            hmrc_errors: ["aaaa"],
          })
        ).toThrow("ci_mapping format is invalid");
      });
    });
  });
});
