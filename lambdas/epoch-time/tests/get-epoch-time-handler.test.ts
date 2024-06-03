import { TimeUnit, lambdaHandler } from "../src/get-epoch-time-handler";
import { Context } from "aws-lambda";

const mockGovJourneyId = "test-government-journey-id";
describe("lambdaHandler", () => {
  it("returns the seconds representation of the provided date", async () => {
    const event = {
      dateTime: "2024-02-26T12:00:00Z",
      govJourneyId: mockGovJourneyId,
    };
    const expectedSeconds = 1708948800;

    const result = await lambdaHandler(event, {} as Context);

    expect(result).toBe(expectedSeconds);
  });

  it("returns the milliseconds representation of the provided date", async () => {
    const event = {
      dateTime: "2024-02-26T12:00:00Z",
      unit: "milliseconds" as TimeUnit,
      govJourneyId: mockGovJourneyId,
    };
    const expectedMilliseconds = 1708948800000;

    const result = await lambdaHandler(event, {} as Context);

    expect(result).toBe(expectedMilliseconds);
  });

  it("returns the milliseconds representation of the provided date", async () => {
    const event = {
      dateTime: "invalidDateTimeFormat",
      unit: "milliseconds" as TimeUnit,
      govJourneyId: mockGovJourneyId,
    };

    expect(
      async () => await lambdaHandler(event, {} as Context)
    ).rejects.toThrow(new Error("Invalid date format"));
  });

  it.each([undefined, null])(
    "throws missing dateTime error when dateTime argument is %s",
    async (value) => {
      expect(
        async () =>
          await lambdaHandler(
            {
              dateTime: value as unknown as string,
              unit: "milliseconds" as TimeUnit,
              govJourneyId: mockGovJourneyId,
            },
            {} as Context
          )
      ).rejects.toThrow(new Error("Invalid event object: missing dateTime"));
    }
  );

  it.each(["minutes, hours"])(
    "throws invalid unit value when unit argument is %s",
    async (value) => {
      expect(
        async () =>
          await lambdaHandler(
            {
              dateTime: "2024-02-26T12:00:00Z",
              unit: value as TimeUnit,
              govJourneyId: mockGovJourneyId,
            },
            {} as Context
          )
      ).rejects.toThrow(new Error(`Invalid unit value: ${value}`));
    }
  );
});
