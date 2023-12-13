import { TimeUnits, timeUnit } from "./time-units";

type TimeUnitMultiplier = {
  [key in TimeUnits]: number;
};

const timeUnitMultipliers: TimeUnitMultiplier = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 60 * 60 * 24,
  months: 60 * 60 * 24 * 30,
  years: 60 * 60 * 24 * 365,
};

export const toEpochSecondsFromNow = (
  duration = 0,
  unit = TimeUnits.Seconds.toString()
): number => msToSeconds(Date.now()) + duration * multiplier(unit);

const multiplier = (unit: string) => timeUnitMultipliers[timeUnit(unit)];
const msToSeconds = (ms: number) => Math.round(ms / 1000);
