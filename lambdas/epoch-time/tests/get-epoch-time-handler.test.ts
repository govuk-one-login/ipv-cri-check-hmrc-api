import { lambdaHandler } from "../src/get-epoch-time-handler";

describe("lambdaHandler", () => {
  it("returns the milliseconds representation of the provided date", async () => {
    const event = { dateTime: "2024-02-26T12:00:00Z" }; // Adjust the dateTime as needed
    const expectedMilliseconds = new Date(event.dateTime).valueOf();

    const result = await lambdaHandler(event);

    expect(result).toBe(expectedMilliseconds);
  });
});
