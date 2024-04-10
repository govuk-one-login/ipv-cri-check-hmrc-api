import {
  getHmrcErrsCiRecord,
  allMappedHmrcErrors,
  isCiHmrcErrorsMappingValid,
  deduplicateContraIndicators,
} from "../../src/utils/ci-mapping-util";

describe("ci-mapping-utils", () => {
  const goodHmrcErrsCiRecordStringOne = "hmrc-error1,hmrc error2:Ci_1";
  const goodHmrcErrsCiRecordStringTwo = "bbbb,cccc,dddd:ci_2";
  const goodHmrcErrsCiRecordStringThree = "eeee,ffff,gggg:ci_3";

  const ci_mapping = [
    goodHmrcErrsCiRecordStringOne,
    goodHmrcErrsCiRecordStringTwo,
    goodHmrcErrsCiRecordStringThree,
  ];
  describe("deduplicate values", () => {
    const test_cis = [
      { ci: "ci_1", reason: "aaaa" },
      { ci: "ci_2", reason: "bbbb" },
      { ci: "ci_3", reason: "cccc" },
    ];
    it("should remove duplicates from inputs", () => {
      expect(
        deduplicateContraIndicators([
          { reason: "aaaa", ci: "ci_1" },
          { ci: "ci_2", reason: "bbbb" },
          { ci: "ci_1", reason: "aaaa" },
          { ci: "ci_3", reason: "cccc" },
        ])
      ).toEqual(test_cis);
    });

    it("should return input same input array, when no duplicates exist", () => {
      expect(deduplicateContraIndicators(test_cis)).toEqual(test_cis);
    });
  });

  describe("get hmrc errors record", () => {
    it("should return an HmrcErrsCiRecord with hmrcErrors and ciValue", () => {
      expect(getHmrcErrsCiRecord(goodHmrcErrsCiRecordStringOne)).toEqual({
        mappedHmrcErrors: "hmrc-error1,hmrc error2",
        ciValue: "Ci_1",
      });
    });
  });

  describe("allMappedHmrcErrors", () => {
    it("should extract all hmrc errors in CiMapping into a comma list of the errors", () => {
      expect(allMappedHmrcErrors(ci_mapping)).toBe(
        "hmrc-error1,hmrc error2,bbbb,cccc,dddd,eeee,ffff,gggg"
      );
    });
  });

  describe("is Ci Hmrc Errors Mapping Valid", () => {
    const badHmrcErrsWithoutCiRecordInString = "hmrc-error1,hmrc error2:";
    const badWithoutHmrcErrsCiRecordInString = ":ci_2";
    const bad_ci_mapping = [
      goodHmrcErrsCiRecordStringOne,
      badWithoutHmrcErrsCiRecordInString,
      goodHmrcErrsCiRecordStringTwo,
      badHmrcErrsWithoutCiRecordInString,
    ];
    it("should return true given a valid ci_mapping", () => {
      expect(isCiHmrcErrorsMappingValid(ci_mapping)).toBe(true);
    });

    it("should return false given invalid ci_mapping without CI component in string", () => {
      expect(
        isCiHmrcErrorsMappingValid([badHmrcErrsWithoutCiRecordInString])
      ).toBe(false);
    });

    it("should return false given invalid ci_mapping without hmrc error component in string", () => {
      expect(
        isCiHmrcErrorsMappingValid([badWithoutHmrcErrsCiRecordInString])
      ).toBe(false);
    });

    it("should return false given invalid ci_mapping that has some good Hmrc Errors CiRecord String", () => {
      expect(isCiHmrcErrorsMappingValid(bad_ci_mapping)).toBe(false);
    });
  });
});
