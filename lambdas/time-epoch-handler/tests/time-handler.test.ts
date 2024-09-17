import { TimeHandler } from "../src/time-handler";
import { TimeUnits } from "../src/utils/time-units";
import { Context } from "aws-lambda";

const monday31st2021InMilliseconds = 1622502000000;
const monday31st2021InSeconds = 1622502000;
const timeHandler = new TimeHandler();
const govJourneyId = "test-government-journey-id";

jest.spyOn(Date, "now").mockReturnValue(monday31st2021InMilliseconds);

describe("time-handler", () => {
  describe("epochMode: claim - return epoch (not before) nbf and (expiry) exp for claim set", () => {
    const epochMode = "claim";
    it("should return an expiry that is the same as nbf", async () => {
      const result = await timeHandler.handler(
        {
          epochType: epochMode,
          govJourneyId,
        },
        {} as Context
      );

      expect(result).toEqual({
        nbf: monday31st2021InSeconds,
        expiry: monday31st2021InSeconds,
      });
    });
    it.each([
      [10, TimeUnits.Seconds, monday31st2021InSeconds + 10],
      [6, TimeUnits.Minutes, monday31st2021InSeconds + 6 * 60],
      [1, TimeUnits.Hours, monday31st2021InSeconds + 60 * 60],
      [5, TimeUnits.Days, monday31st2021InSeconds + 5 * 60 * 60 * 24],
      [3, TimeUnits.Years, monday31st2021InSeconds + 3 * 60 * 60 * 24 * 365],
    ])(
      "should return an expiry that expires in %s %s",
      async (ttlValue, ttlUnit, expectedExpiryInEpochSeconds) => {
        const result = await timeHandler.handler(
          {
            epochType: epochMode,
            govJourneyId,
            ttlValue,
            ttlUnit,
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
            epochType: epochMode,
            govJourneyId,
            ttlValue: ttlValue as number,
            ttlUnit: TimeUnits.Seconds,
          },
          {} as Context
        );

        expect(result).toEqual({
          nbf: monday31st2021InSeconds,
          expiry: monday31st2021InSeconds,
        });
      }
    );
  });
  describe("epochMode: auth - return authorization code expiry", () => {
    const epochMode = "auth";
    it("should return an expiry that is the same as the current epoch second", async () => {
      const result = await timeHandler.handler(
        {
          epochType: epochMode,
          govJourneyId,
        },
        {} as Context
      );

      expect(result).toEqual({
        authCodeExpiry: 1622502000,
      });
    });
    it.each([
      [10, TimeUnits.Seconds, monday31st2021InSeconds + 10],
      [6, TimeUnits.Minutes, monday31st2021InSeconds + 6 * 60],
      [1, TimeUnits.Hours, monday31st2021InSeconds + 60 * 60],
      [5, TimeUnits.Days, monday31st2021InSeconds + 5 * 60 * 60 * 24],
      [3, TimeUnits.Years, monday31st2021InSeconds + 3 * 60 * 60 * 24 * 365],
    ])(
      "should return an expiry that expires in %s %s",
      async (ttlValue, ttlUnit, expectedExpiryInEpochSeconds) => {
        const result = await timeHandler.handler(
          {
            epochType: epochMode,
            govJourneyId,
            ttlValue,
            ttlUnit,
          },
          {} as Context
        );

        expect(result).toEqual({
          authCodeExpiry: expectedExpiryInEpochSeconds,
        });
      }
    );

    it.each([0, null, undefined])(
      "should return the current time in seconds for nbf and expiry if ttl is %s",
      async (ttlValue) => {
        const result = await timeHandler.handler(
          {
            epochType: epochMode,
            govJourneyId,
            ttlValue: ttlValue as number,
            ttlUnit: TimeUnits.Seconds,
          },
          {} as Context
        );

        expect(result).toEqual({
          authCodeExpiry: 1622502000,
        });
      }
    );
  });
  describe("epochMode: time - epoch seconds and milliseconds", () => {
    const epochMode = "time";
    it("should return time in epoch milliseconds and seconds", async () => {
      const result = await timeHandler.handler(
        {
          epochType: epochMode,
          govJourneyId,
        },
        {} as Context
      );

      expect(result).toEqual({
        milliseconds: monday31st2021InMilliseconds,
        seconds: monday31st2021InSeconds,
      });
    });
    it.each([0, null, undefined, 10, 123, "any value"])(
      "should return epoch(s) ignoring ttlValue if specified",
      async (ttlValue) => {
        const result = await timeHandler.handler(
          {
            epochType: epochMode,
            govJourneyId,
            ttlValue: ttlValue as number,
            ttlUnit: TimeUnits.Seconds,
          },
          {} as Context
        );

        expect(result).toEqual({
          milliseconds: monday31st2021InMilliseconds,
          seconds: monday31st2021InSeconds,
        });
      }
    );
    it.each([
      "unknown",
      "",
      null,
      TimeUnits.Years,
      TimeUnits.Days,
      TimeUnits.Months,
      TimeUnits.Minutes,
      "any value",
    ])(
      "should return epoch(s) ignoring the ttlUnit if specified",
      async (ttlUnit) => {
        const result = await timeHandler.handler(
          {
            epochType: epochMode,
            govJourneyId,
            ttlValue: 0,
            ttlUnit: ttlUnit as string,
          },
          {} as Context
        );
        expect(result).toEqual({
          milliseconds: monday31st2021InMilliseconds,
          seconds: monday31st2021InSeconds,
        });
      }
    );
  });
  describe.each(["claim", "auth"])("epochMode: %s", (epochMode) => {
    it.each(["unknown", "", null])(
      "should throw when invalid %s time unit is specified for epochMode %s",
      async (ttlUnit) => {
        await expect(
          timeHandler.handler(
            {
              epochType: epochMode,
              govJourneyId,
              ttlValue: 0,
              ttlUnit: ttlUnit as string,
            },
            {} as Context
          )
        ).rejects.toThrow(`Time unit must be valid: ${ttlUnit}`);
      }
    );

    it("should throw when ttl value is negative for epochMode %s", async () => {
      await expect(
        timeHandler.handler(
          {
            epochType: epochMode,
            govJourneyId,
            ttlValue: -1,
            ttlUnit: TimeUnits.Seconds,
          },
          {} as Context
        )
      ).rejects.toThrow(/must be positive/);
    });

    it("should throw when invalid epochMode is specified", () => {
      expect(
        timeHandler.handler(
          {
            epochType: "invalid",
            govJourneyId,
            ttlValue: 0,
            ttlUnit: TimeUnits.Seconds,
          },
          {} as Context
        )
      ).rejects.toThrow("Invalid mode: invalid");
    });
  });
});
