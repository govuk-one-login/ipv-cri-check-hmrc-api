export enum TimeUnits {
  Seconds = "seconds",
  Minutes = "minutes",
  Hours = "hours",
  Days = "days",
  Months = "months",
  Years = "years",
}

export const timeUnit = (value?: string) => {
  const unit = value?.toLowerCase() as TimeUnits;
  if (!Object.values(TimeUnits).includes(unit)) {
    throw new Error(`Time unit must be valid: ${value}`);
  }

  return unit;
};
