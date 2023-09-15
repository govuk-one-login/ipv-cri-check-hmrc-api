import { TimeHandler } from "../src/time-handler";
import { Context } from "aws-lambda";
import { TimeEvent } from "../src/time-event";

describe("matching-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return the current value for Date.now()", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1622502000000);

    const event = {
      ttl: 0,
      ttlUnit: "none",
    } as TimeEvent;

    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);

    expect(result).toBe(1622502000000);
  });

  it("should return a time that expires in 10 seconds", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1622502000000);
    const event = {
      ttl: 10,
      ttlUnit: "seconds",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toBe(1622502000000 + 10000);
  });

  it("should return a time that expires in 10 minutes", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1622502000000);
    const event = {
      ttl: 10,
      ttlUnit: "minutes",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toBe(1622502000000 + 10 * (1000 * 60));
  });
});
