import { TimeUnit, lambdaHandler } from "../src/get-epoch-time-handler";

describe("lambdaHandler", () => {
  it("returns the seconds representation of the provided date", async () => {
    const event = {
      dateTime: "2024-02-26T12:00:00Z",
    };
    const expectedSeconds = 1708948800;

    const result = await lambdaHandler(event);

    expect(result).toBe(expectedSeconds);
  });

  it("returns the milliseconds representation of the provided date", async () => {
    const event = {
      dateTime: "2024-02-26T12:00:00Z",
      unit: "milliseconds" as TimeUnit,
    };
    const expectedMilliseconds = 1708948800000;

    const result = await lambdaHandler(event);

    expect(result).toBe(expectedMilliseconds);
  });

  it("returns the milliseconds representation of the provided date", async () => {
    const event = {
      dateTime: "invalidDateTimeFormat",
      unit: "milliseconds" as TimeUnit,
    };

    expect(async () => await lambdaHandler(event)).rejects.toThrow(
      new Error("Invalid date format")
    );
  });

  it.each([undefined, null])(
    "throws missing dateTime error when dateTime argument is %s",
    async (value) => {
      expect(
        async () =>
          await lambdaHandler({
            dateTime: value as unknown as string,
            unit: "milliseconds" as TimeUnit,
          })
      ).rejects.toThrow(new Error("Invalid event object: missing dateTime"));
    }
  );

  it.each(["minutes, hours"])(
    "throws invalid unit value when unit argument is %s",
    async (value) => {
      expect(
        async () =>
          await lambdaHandler({
            dateTime: "2024-02-26T12:00:00Z",
            unit: value as TimeUnit,
          })
      ).rejects.toThrow(new Error(`Invalid unit value: ${value}`));
    }
  );
});
