export enum TimeUnits {
  Seconds = "Seconds",
  Minutes = "Minutes",
  Hours = "Hours",
  Days = "Days",
  Months = "Months",
  Years = "Years",
}

function capitalizeFirstLetter(val: string) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}
export const timeUnit = (value?: string) => {
  const unit = capitalizeFirstLetter(value?.toLowerCase() ?? "") as TimeUnits;
  if (!Object.values(TimeUnits).includes(unit)) {
    throw new Error(`Time unit must be valid: ${value}`);
  }

  return unit;
};

const timeUnitMultipliers: Record<TimeUnits, number> = {
  Seconds: 1,
  Minutes: 60,
  Hours: 60 * 60,
  Days: 60 * 60 * 24,
  Months: 60 * 60 * 24 * 30,
  Years: 60 * 60 * 24 * 365,
};

export const toEpochSecondsFromNow = (duration = 0, unit: TimeUnits = TimeUnits.Seconds): number =>
  msToSeconds(milliseconds()) + duration * multiplier(unit);
export const milliseconds = () => Date.now();
export const msToSeconds = (ms: number) => Math.round(ms / 1000);
const multiplier = (unit: string) => timeUnitMultipliers[timeUnit(unit)];
