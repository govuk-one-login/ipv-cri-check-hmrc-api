import { TimeUnits, toEpochSecondsFromNow } from "../../../common/src/util/date-time";

const monday31st2021InMilliseconds = 1622502000000;
const monday31st2021InSeconds = 1622502000;

jest.spyOn(Date, "now").mockReturnValue(monday31st2021InMilliseconds);

describe("DateTime utils", () => {
  describe("toEpochSeconds", () => {
    it.each([[undefined, 0, monday31st2021InSeconds]])(
      "should return Monday 31st, 2021 when ttl is zero and ttlUnit is undefined",
      (ttlUnit, ttl, expected) => {
        expect(toEpochSecondsFromNow(ttl, ttlUnit)).toBe(expected);
      }
    );

    it("should return Monday 31st, 2021 by default when neither ttl nor ttlUnit is specified", () => {
      expect(toEpochSecondsFromNow()).toBe(monday31st2021InSeconds);
    });

    it.each([
      [TimeUnits.Seconds, monday31st2021InSeconds],
      [TimeUnits.Minutes, monday31st2021InSeconds],
      [TimeUnits.Hours, monday31st2021InSeconds],
      [TimeUnits.Days, monday31st2021InSeconds],
      [TimeUnits.Months, monday31st2021InSeconds],
      [TimeUnits.Years, monday31st2021InSeconds],
    ])("should return value in seconds when unit (%s) is specified and value is not specified", (unit, expected) => {
      expect(toEpochSecondsFromNow(0, unit)).toBe(expected);
    });

    it.each([
      ["SECONDS", 0, monday31st2021InSeconds],
      ["MINUTES", 0, monday31st2021InSeconds],
      ["houRs", 0, monday31st2021InSeconds],
      ["dAys", 0, monday31st2021InSeconds],
      ["months", 0, monday31st2021InSeconds],
      ["YEars", 0, monday31st2021InSeconds],
    ])(
      "should return value in seconds irrespective of unit case sensitivity %s is specified for value of %s",
      (unit, value, expected) => {
        expect(toEpochSecondsFromNow(value, unit as TimeUnits)).toBe(expected);
      }
    );

    it.each([
      [TimeUnits.Seconds, 5, monday31st2021InSeconds + 5],
      [TimeUnits.Minutes, 10, monday31st2021InSeconds + 10 * 60],
      [TimeUnits.Hours, 4, monday31st2021InSeconds + 4 * (60 * 60)],
      [TimeUnits.Days, 18, monday31st2021InSeconds + 18 * (60 * 60 * 24)],
      [TimeUnits.Months, 5, monday31st2021InSeconds + 5 * (60 * 60 * 24 * 30)],
      [TimeUnits.Years, 5, monday31st2021InSeconds + 5 * (60 * 60 * 24 * 365)],
    ])("should return value in seconds when unit (%s) is specified for value of %s", (unit, value, expected) => {
      expect(toEpochSecondsFromNow(value, unit)).toBe(expected);
    });

    it.each([null, "invalidUnit"])("should error when time unit %s specified is not found", (unit) =>
      expect(() => toEpochSecondsFromNow(0, unit as TimeUnits)).toThrow(`Time unit must be valid: ${unit}`)
    );
  });
});
