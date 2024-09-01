import { lambdaHandler } from "../src/get-epoch-time-handler";
import { Context } from "aws-lambda";

const mockGovJourneyId = "test-government-journey-id";
describe("lambdaHandler", () => {
  it("returns an object with epoch secs and milliseconds representation of the provided date", async () => {
    const expectedMilliseconds = 1708948800000;
    const expectedSeconds = 1708948800;

    jest.spyOn(Date, "now").mockReturnValue(expectedMilliseconds);
    const event = {
      govJourneyId: mockGovJourneyId,
    };

    const result = await lambdaHandler(event, {} as Context);

    expect(result).toEqual({
      milliseconds: expectedMilliseconds,
      seconds: expectedSeconds,
    });
  });
});
