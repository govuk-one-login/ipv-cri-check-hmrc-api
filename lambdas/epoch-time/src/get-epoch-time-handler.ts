export const lambdaHandler = async ({
  dateTime,
  unit = "seconds",
}: {
  dateTime?: string;
  unit?: "seconds" | "milliseconds";
} = {}): Promise<number> => {
  if (!dateTime) {
    throw new Error("Invalid event object: missing dateTime");
  }

  const timestamp = new Date(dateTime).getTime();

  if (isNaN(timestamp)) {
    throw new Error("Invalid date format");
  }
  if (!["seconds", "milliseconds"].includes(unit)) {
    throw new Error(`Invalid unit value: ${unit}`);
  }

  return unit === "milliseconds" ? timestamp : Math.floor(timestamp / 1000);
};
