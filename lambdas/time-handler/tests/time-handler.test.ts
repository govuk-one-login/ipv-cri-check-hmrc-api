import { TimeEvent } from "../src/time-event";
import { TimeHandler } from "../src/time-handler";
import { TimeUnits } from "../src/utils/time-units";
import { Context } from "aws-lambda";

const monday31st2021InMilliseconds = 1622502000000;
const monday31st2021InSeconds = 1622502000;
const timeHandler = new TimeHandler();
const govJourneyId = "test-government-journey-id";

jest.spyOn(Date, "now").mockReturnValue(monday31st2021InMilliseconds);

describe("time-handler", () => {
  describe("context Nino Check State StateMachine - Fetch Auth Code Expiry task", () => {
    describe("generates authorizationCode expiry", () => {
      it("returns an expiry that is the same as the current epoch second", async () => {
        const result = await timeHandler.handler(
          { govJourneyId },
          {} as Context
        );

        const authorizationCodeExpiry = monday31st2021InSeconds;

        expect(result).toEqual(
          expect.objectContaining({
            expiry: authorizationCodeExpiry,
          })
        );
      });
      it.each([
        [10, TimeUnits.Seconds, monday31st2021InSeconds + 10],
        [6, TimeUnits.Minutes, monday31st2021InSeconds + 6 * 60],
        [1, TimeUnits.Hours, monday31st2021InSeconds + 60 * 60],
        [5, TimeUnits.Days, monday31st2021InSeconds + 5 * 60 * 60 * 24],
        [3, TimeUnits.Years, monday31st2021InSeconds + 3 * 60 * 60 * 24 * 365],
      ])(
        "returns an expiry that expires in %s %s",
        async (ttlValue, ttlUnit, expectedExpiryInEpochSeconds) => {
          const result = await timeHandler.handler(
            { govJourneyId, ttlValue, ttlUnit } as TimeEvent,
            {} as Context
          );

          const authorizationCodeExpiry = expectedExpiryInEpochSeconds;

          expect(result).toEqual(
            expect.objectContaining({
              expiry: authorizationCodeExpiry,
            })
          );
        }
      );

      it.each([0, undefined])(
        "returns the expiry in seconds if ttl is %s",
        async (ttlValue) => {
          const result = await timeHandler.handler(
            {
              govJourneyId,
              ttlValue: ttlValue,
              ttlUnit: TimeUnits.Seconds,
            } as TimeEvent,
            {} as Context
          );

          const authorizationCodeExpiry = monday31st2021InSeconds;

          expect(result).toEqual(
            expect.objectContaining({
              expiry: authorizationCodeExpiry,
            })
          );
        }
      );
    });
  });
  describe("context Audit Event / Check Session StateMachine - Get EpochTime task / Fetch Current Time", () => {
    describe("generates epoch seconds and milliseconds", () => {
      it("returns time in epoch milliseconds and seconds", async () => {
        const result = await timeHandler.handler(
          {
            govJourneyId,
          },
          {} as Context
        );

        expect(result).toEqual(
          expect.objectContaining({
            milliseconds: monday31st2021InMilliseconds,
            seconds: monday31st2021InSeconds,
          })
        );
      });
      it.each([0, null, undefined, 10, 123, "any value"])(
        "returns epoch(s) ignoring ttlValue %s specified",
        async (ttlValue) => {
          const result = await timeHandler.handler(
            {
              govJourneyId,
              ttlValue: ttlValue,
              ttlUnit: TimeUnits.Seconds,
            } as TimeEvent,
            {} as Context
          );

          expect(result).toEqual(
            expect.objectContaining({
              milliseconds: monday31st2021InMilliseconds,
              seconds: monday31st2021InSeconds,
            })
          );
        }
      );
    });
  });
  describe("context Nino IssueCredential StateMachine - Fetch exp time and NBF task", () => {
    describe("generates claims attributes (not before) nbf and (expiry) epoch(s)", () => {
      it("returns an expiry that is the same as it's nbf", async () => {
        const result = await timeHandler.handler(
          { govJourneyId },
          {} as Context
        );
        const nbf = monday31st2021InSeconds;
        const exp = monday31st2021InSeconds;
        expect(result).toEqual(
          expect.objectContaining({
            seconds: nbf,
            expiry: exp,
          })
        );
      });
      it.each([
        [10, TimeUnits.Seconds, monday31st2021InSeconds + 10],
        [6, TimeUnits.Minutes, monday31st2021InSeconds + 6 * 60],
        [1, TimeUnits.Hours, monday31st2021InSeconds + 60 * 60],
        [5, TimeUnits.Days, monday31st2021InSeconds + 5 * 60 * 60 * 24],
        [3, TimeUnits.Years, monday31st2021InSeconds + 3 * 60 * 60 * 24 * 365],
      ])(
        "returns an expiry that expires in %s %s",
        async (ttlValue, ttlUnit, expectedExpiryInEpochSeconds) => {
          const result = await timeHandler.handler(
            { govJourneyId, ttlValue, ttlUnit } as TimeEvent,
            {} as Context
          );

          const nbf = monday31st2021InSeconds;
          const exp = expectedExpiryInEpochSeconds;

          expect(result).toEqual(
            expect.objectContaining({
              seconds: nbf,
              expiry: exp,
            })
          );
        }
      );

      it.each([0, undefined])(
        "returns the current time in seconds for nbf and expiry if ttl is %s",
        async (ttlValue) => {
          const result = await timeHandler.handler(
            {
              govJourneyId,
              ttlValue: ttlValue,
              ttlUnit: TimeUnits.Seconds,
            } as unknown as TimeEvent,
            {} as Context
          );

          const nbf = monday31st2021InSeconds;
          const exp = monday31st2021InSeconds;

          expect(result).toEqual(
            expect.objectContaining({
              seconds: nbf,
              expiry: exp,
            })
          );
        }
      );
    });
  });
  describe("context failure", () => {
    it.each(["unknown", "", null])(
      "throws error when invalid %s time unit is specified",
      async (ttlUnit) => {
        await expect(
          timeHandler.handler(
            {
              govJourneyId,
              ttlValue: 0,
              ttlUnit: ttlUnit,
            } as TimeEvent,
            {} as Context
          )
        ).rejects.toThrow(`Time unit must be valid: ${ttlUnit}`);
      }
    );

    it("throws error when ttl value is negative", async () => {
      await expect(
        timeHandler.handler(
          {
            govJourneyId,
            ttlValue: -1,
            ttlUnit: TimeUnits.Seconds,
          } as TimeEvent,
          {} as Context
        )
      ).rejects.toThrow(/must be positive/);
    });
  });
});
