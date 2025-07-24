import {
  allMappedHmrcErrors,
  getHmrcErrsCiRecord,
  isCiHmrcErrorsMappingValid,
} from "../../../src/vc/contraIndicator/ci-mapping-util";

describe("ci-mapping-utils", () => {
  const goodHmrcErrsCiRecordStringOne = '"An error description, with a comma",hmrc-error1,hmrc error2:Ci_1';
  const goodHmrcErrsCiRecordStringTwo = "bbbb,cccc,dddd:ci_2";
  const goodHmrcErrsCiRecordStringThree = "eeee,ffff,gggg:ci_3";

  const ContraIndicationMapping = [
    goodHmrcErrsCiRecordStringOne,
    goodHmrcErrsCiRecordStringTwo,
    goodHmrcErrsCiRecordStringThree,
  ];

  describe("get hmrc errors record", () => {
    it("should return an HmrcErrsCiRecord with hmrcErrors and ciValue", () => {
      expect(getHmrcErrsCiRecord(goodHmrcErrsCiRecordStringOne)).toEqual({
        mappedHmrcErrors: '"An error description, with a comma",hmrc-error1,hmrc error2',
        ciValue: "Ci_1",
      });
    });
  });

  describe("allMappedHmrcErrors", () => {
    it("should extract all hmrc errors in CiMapping into a comma list of the errors", () => {
      expect(allMappedHmrcErrors(ContraIndicationMapping)).toBe(
        '"An error description, with a comma",hmrc-error1,hmrc error2,bbbb,cccc,dddd,eeee,ffff,gggg'
      );
    });
  });

  describe("is Ci Hmrc Errors Mapping Valid", () => {
    const badHmrcErrsWithoutCiRecordInString = "hmrc-error1,hmrc error2:";
    const badWithoutHmrcErrsCiRecordInString = ":ci_2";
    const bad_ContraIndicationMapping = [
      goodHmrcErrsCiRecordStringOne,
      badWithoutHmrcErrsCiRecordInString,
      goodHmrcErrsCiRecordStringTwo,
      badHmrcErrsWithoutCiRecordInString,
    ];
    it("should return true given a valid ContraIndicationMapping", () => {
      expect(isCiHmrcErrorsMappingValid(ContraIndicationMapping)).toBe(true);
    });

    it("should return false given invalid ContraIndicationMapping without CI component in string", () => {
      expect(isCiHmrcErrorsMappingValid([badHmrcErrsWithoutCiRecordInString])).toBe(false);
    });

    it("should return false given invalid ContraIndicationMapping without hmrc error component in string", () => {
      expect(isCiHmrcErrorsMappingValid([badWithoutHmrcErrsCiRecordInString])).toBe(false);
    });

    it("should return false given invalid ContraIndicationMapping that has some good Hmrc Errors CiRecord String", () => {
      expect(isCiHmrcErrorsMappingValid(bad_ContraIndicationMapping)).toBe(false);
    });
  });
});
