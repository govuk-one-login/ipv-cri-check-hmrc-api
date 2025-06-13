import { TimeUnits, timeUnit } from "./time-units";

type TimeUnitMultiplier = Record<TimeUnits, number>;

const timeUnitMultipliers: TimeUnitMultiplier = {
  Seconds: 1,
  Minutes: 60,
  Hours: 60 * 60,
  Days: 60 * 60 * 24,
  Months: 60 * 60 * 24 * 30,
  Years: 60 * 60 * 24 * 365,
};

export const toEpochSecondsFromNow = (
  duration = 0,
  unit: TimeUnits = TimeUnits.Seconds
): number => msToSeconds(milliseconds()) + duration * multiplier(unit);
export const milliseconds = () => Date.now();
export const msToSeconds = (ms: number) => Math.round(ms / 1000);
const multiplier = (unit: string) => timeUnitMultipliers[timeUnit(unit)];
