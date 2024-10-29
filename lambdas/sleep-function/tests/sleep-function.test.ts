import { SleepFunction } from "../src/sleep-function";

describe("SleepFunction", () => {
  it("should wait for the specified milliseconds", async () => {
    const ms = 1000;
    const sleepFunction = new SleepFunction();
    const start = Date.now();
    await sleepFunction.handler({ ms: ms }, {});
    expect(Date.now() - start).toBeGreaterThanOrEqual(ms);
  });
});
