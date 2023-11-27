import { TimeHandler } from "../src/time-handler";
import { Context } from "aws-lambda";
import { TimeEvent } from "../src/time-event";

describe("time-handler", () => {
  const mon31st2021InMilliseconds = 1622502000000;
  const mon31st2021InSeconds = 1622502000;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return the current time for nbf", async () => {
    jest.spyOn(Date, "now").mockReturnValue(mon31st2021InMilliseconds);
    const event = {
      ttl: 10,
      ttlUnit: "seconds",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result.nbf).toBe(mon31st2021InSeconds);
  });

  it("should return a expiry that expires in 10 seconds", async () => {
    jest.spyOn(Date, "now").mockReturnValue(mon31st2021InMilliseconds);
    const event = {
      ttl: 10,
      ttlUnit: "seconds",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toEqual({
      nbf: mon31st2021InSeconds,
      expiry: mon31st2021InSeconds + 10000,
    });
  });

  it("should return a expiry that expires in 10 minutes", async () => {
    jest.spyOn(Date, "now").mockReturnValue(mon31st2021InMilliseconds);
    const event = {
      ttl: 10,
      ttlUnit: "minutes",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toEqual({
      nbf: mon31st2021InSeconds,
      expiry: mon31st2021InSeconds + 10 * (1000 * 60),
    });
  });

  it("should return a expiry that expires in 1 hour", async () => {
    jest.spyOn(Date, "now").mockReturnValue(mon31st2021InMilliseconds);
    const event = {
      ttl: 1,
      ttlUnit: "hours",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toEqual({
      nbf: mon31st2021InSeconds,
      expiry: mon31st2021InSeconds + 1000 * 60 * 60,
    });
  });

  it("should return a expiry that expires in 1 day", async () => {
    jest.spyOn(Date, "now").mockReturnValue(mon31st2021InMilliseconds);
    const event = {
      ttl: 1,
      ttlUnit: "days",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toEqual({
      nbf: mon31st2021InSeconds,
      expiry: mon31st2021InSeconds + 1000 * 60 * 60 * 24,
    });
  });

  it("should return a expiry that expires in 1 month", async () => {
    jest.spyOn(Date, "now").mockReturnValue(mon31st2021InMilliseconds);
    const event = {
      ttl: 1,
      ttlUnit: "months",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toEqual({
      nbf: mon31st2021InSeconds,
      expiry: mon31st2021InSeconds + 1000 * 60 * 60 * 24 * 30,
    });
  });

  it("should return a expiry that expires in 1 year", async () => {
    jest.spyOn(Date, "now").mockReturnValue(mon31st2021InMilliseconds);
    const event = {
      ttl: 1,
      ttlUnit: "years",
    } as TimeEvent;
    const timeHandler = new TimeHandler();
    const result = await timeHandler.handler(event, {} as Context);
    expect(result).toEqual({
      nbf: mon31st2021InSeconds,
      expiry: mon31st2021InSeconds + 1000 * 60 * 60 * 24 * 365,
    });
  });
});
