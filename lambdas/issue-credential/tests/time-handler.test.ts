import { TimeHandler } from "../src/time-handler";
import { TimeUnits } from "../src/utils/time-units";
import { Context } from "aws-lambda";

const monday31st2021InMilliseconds = 1622502000000;
const monday31st2021InSeconds = 1622502000;
const timeHandler = new TimeHandler();
const govJourneyId = "test-government-journey-id";

jest.spyOn(Date, "now").mockReturnValue(monday31st2021InMilliseconds);

describe("time-handler", () => {
  it.each([
    [10, TimeUnits.Seconds, monday31st2021InSeconds + 10],
    [6, TimeUnits.Minutes, monday31st2021InSeconds + 6 * 60],
    [1, TimeUnits.Hours, monday31st2021InSeconds + 60 * 60],
    [5, TimeUnits.Days, monday31st2021InSeconds + 5 * 60 * 60 * 24],
    [3, TimeUnits.Years, monday31st2021InSeconds + 3 * 60 * 60 * 24 * 365],
  ])(
    "should return a expiry that expires in %s %s",
    async (ttlValue, ttlUnit, expectedExpiryInEpochSeconds) => {
      const result = await timeHandler.handler(
        {
          ttlValue,
          ttlUnit,
          govJourneyId,
        },
        {} as Context
      );

      expect(result).toEqual({
        nbf: monday31st2021InSeconds,
        expiry: expectedExpiryInEpochSeconds,
      });
    }
  );

  it.each([0, null, undefined])(
    "should return the current time in seconds for nbf and expiry if ttl is %s",
    async (ttlValue) => {
      const result = await timeHandler.handler(
        {
          ttlValue: ttlValue as number,
          ttlUnit: TimeUnits.Seconds,
          govJourneyId,
        },
        {} as Context
      );

      expect(result).toEqual({
        nbf: monday31st2021InSeconds,
        expiry: monday31st2021InSeconds,
      });
    }
  );

  it.each(["unknown", "", null])(
    "should throw when invalid %s time unit is specified",
    (ttlUnit) => {
      expect(
        timeHandler.handler(
          {
            ttlValue: 0,
            ttlUnit: ttlUnit as string,
            govJourneyId,
          },
          {} as Context
        )
      ).rejects.toThrow(`Time unit must be valid: ${ttlUnit}`);
    }
  );

  it("should throw when ttl value is negative", () =>
    expect(
      timeHandler.handler(
        { ttlValue: -1, ttlUnit: TimeUnits.Seconds, govJourneyId },
        {} as Context
      )
    ).rejects.toThrow(/must be positive/));
});
