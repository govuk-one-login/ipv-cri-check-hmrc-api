import { Context } from "aws-lambda";
import { CurrentTimeHandler } from "../src/current-time-handler";

describe("current-time-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return current time in expected format", async () => {
    const mockTimestamp = 1622502000000; // 31/05/2021
    jest.spyOn(Date, "now").mockReturnValue(mockTimestamp);

    const handler = new CurrentTimeHandler();
    const result = await handler.handler({} as unknown, {} as Context);

    expect(result).toEqual({
      milliseconds: mockTimestamp,
      seconds: Math.floor(mockTimestamp / 1000),
    });
  });
});
