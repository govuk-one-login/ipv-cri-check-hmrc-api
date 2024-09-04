import {
  claimEpochFunction,
  timeEpochFunction,
  authEpochFunction,
} from "../src/epoch-categories";
import { TimeEvent } from "../src/time-event";
import { msToSeconds } from "../src/utils/date-time";
import { TimeUnits } from "../src/utils/time-units";
describe("Epoch functions", () => {
  let currentEpochTimeInMilliseconds: number;
  let currentEpochTimeInSeconds: number;

  beforeEach(() => {
    currentEpochTimeInMilliseconds = Date.now();
    currentEpochTimeInSeconds = msToSeconds(currentEpochTimeInMilliseconds);
  });

  describe("claimEpochFunction", () => {
    it("returns nbf and expiry equal to current epoch time when no ttlValue or ttlUnit is provided", () => {
      const event: TimeEvent = {
        ttlValue: undefined,
        ttlUnit: undefined,
      } as TimeEvent;

      const result = claimEpochFunction(event);

      expect(result).toEqual({
        nbf: currentEpochTimeInSeconds,
        expiry: currentEpochTimeInSeconds,
      });
    });

    it("returns expiry correctly based on ttlValue and ttlUnit", () => {
      const ttlValue = 10;
      const ttlUnit = TimeUnits.Seconds;
      const event: TimeEvent = { ttlValue, ttlUnit } as TimeEvent;

      const result = claimEpochFunction(event);

      const tenSeconds = ttlValue * 1;
      const expectedExpiry = currentEpochTimeInSeconds + tenSeconds;
      expect(result).toEqual({
        nbf: currentEpochTimeInSeconds,
        expiry: expectedExpiry,
      });
    });

    it("returns expiry correctly for different time units", () => {
      const event: TimeEvent = {
        ttlValue: 5,
        ttlUnit: TimeUnits.Days,
      } as TimeEvent;

      const result = claimEpochFunction(event);

      const fiveDays = 5 * 60 * 60 * 24;
      const expectedExpiry = currentEpochTimeInSeconds + fiveDays;
      expect(result).toEqual({
        nbf: currentEpochTimeInSeconds,
        expiry: expectedExpiry,
      });
    });

    it("handles null ttlValue and ttlUnit gracefully", () => {
      const event: TimeEvent = {
        ttlValue: null,
        ttlUnit: null,
      } as unknown as TimeEvent;

      expect(() => claimEpochFunction(event)).toThrow(
        "Time unit must be valid: null"
      );
    });
  });

  describe("timeEpochFunction", () => {
    it("returns the current time in seconds, string, and milliseconds", () => {
      const result = timeEpochFunction();

      expect(result).toEqual({
        seconds: currentEpochTimeInSeconds,
        milliseconds: currentEpochTimeInMilliseconds,
      });
    });
  });

  describe("authEpochFunction", () => {
    it("returns authCodeExpiry based on ttlValue and ttlUnit", () => {
      const ttlValue = 5;
      const ttlUnit = TimeUnits.Minutes;
      const event: TimeEvent = { ttlValue, ttlUnit } as TimeEvent;

      const result = authEpochFunction(event);

      const fiveMinutes = ttlValue * 60;
      const expectedAuthCodeExpiry = currentEpochTimeInSeconds + fiveMinutes;
      expect(result).toEqual({
        authCodeExpiry: expectedAuthCodeExpiry,
      });
    });

    it("returns authCodeExpiry equal to current time when no ttlValue or ttlUnit is provided", () => {
      const event: TimeEvent = {
        ttlValue: undefined,
        ttlUnit: undefined,
      } as TimeEvent;

      const result = authEpochFunction(event);

      expect(result).toEqual({
        authCodeExpiry: currentEpochTimeInSeconds,
      });
    });
  });
});
