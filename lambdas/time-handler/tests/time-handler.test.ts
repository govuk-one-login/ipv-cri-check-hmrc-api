import { TimeEvent } from "../src/time-event";
import { TimeHandler } from "../src/time-handler";
import { TimeUnits } from "../src/utils/time-units";
import { Context } from "aws-lambda";

const monday31st2021InMilliseconds = 1622502000000;
const monday31st2021InSeconds = 1622502000;
const timeHandler = new TimeHandler();
const govJourneyId = "test-government-journey-id";

jest.spyOn(Date, "now").mockReturnValue(monday31st2021InMilliseconds);

describe("time-handler generates epoch second, millisecond and / or expiry when ttlUnit and ttlValue is specified", () => {
  describe("generic context i.e some other step-function tasks needs an epoch second, millisecond or expiry by specifying ttlUnit and ttlValue required", () => {
    it("returns the epoch time in seconds and milliseconds, with expiry set to current time", async () => {
      const result = await timeHandler.handler({ govJourneyId }, {} as Context);

      expect(result).toEqual({
        seconds: monday31st2021InSeconds,
        milliseconds: monday31st2021InMilliseconds,
        expiry: monday31st2021InSeconds,
      });
    });

    it.each([
      [10, TimeUnits.Seconds, monday31st2021InSeconds + 10],
      [-3, TimeUnits.Seconds, monday31st2021InSeconds - 3],
      [5, TimeUnits.Minutes, monday31st2021InSeconds + 5 * 60],
      [1, TimeUnits.Hours, monday31st2021InSeconds + 60 * 60],
      [1, TimeUnits.Days, monday31st2021InSeconds + 60 * 60 * 24],
      [1, TimeUnits.Years, monday31st2021InSeconds + 60 * 60 * 24 * 365],
    ])(
      "returns the epoch seconds and milliseconds, when ttlValue %s and ttlUnit %s is specified also it returns an expiry of %s",
      async (ttlValue, ttlUnit, expectedExpiry) => {
        const event: TimeEvent = {
          govJourneyId,
          ttlValue,
          ttlUnit,
        };

        const result = await timeHandler.handler(event, {} as Context);

        expect(result).toEqual({
          seconds: monday31st2021InSeconds,
          milliseconds: monday31st2021InMilliseconds,
          expiry: expectedExpiry,
        });
      }
    );

    it("defaults expiry to the current time in seconds if ttlValue is undefined", async () => {
      const event: TimeEvent = { govJourneyId, ttlUnit: TimeUnits.Seconds };

      const result = await timeHandler.handler(event, {} as Context);

      expect(result).toEqual({
        seconds: monday31st2021InSeconds,
        milliseconds: monday31st2021InMilliseconds,
        expiry: monday31st2021InSeconds,
      });
    });
  });

  describe("example context Nino Check State StateMachine - Fetch Auth Code Expiry task", () => {
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
        "returns an expiry, when given ttlValue of %d %s expires in %s %s",
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

      it("returns the expiry as the current epoch seconds if ttlValue is absent", async () => {
        const result = await timeHandler.handler(
          {
            govJourneyId,
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
      });
    });
  });
  describe("example context Audit Event / Check Session StateMachine - Get EpochTime task / Fetch Current Time", () => {
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
        "returns epoch seconds and millisecond and the expiry generated can be ignored when ttlValue %s specified",
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
              expiry: expect.any(Number),
            })
          );
        }
      );
    });
  });
  describe("example context Nino IssueCredential StateMachine - Fetch exp time and NBF task", () => {
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

      it("returns the current time in seconds for nbf and expiry if ttl is absent", async () => {
        const result = await timeHandler.handler(
          {
            govJourneyId,
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
      });
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
  });
});
