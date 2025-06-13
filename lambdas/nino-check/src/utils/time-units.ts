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
