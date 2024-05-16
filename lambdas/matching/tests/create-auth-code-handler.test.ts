import { Context } from "aws-lambda";
import { CreateAuthCodeHandler } from "../src/create-auth-code-handler";

describe("create-auth-code-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it("should return an expiry 10 minutes after Date.now()", async () => {
    const mayThirtyOne2021 = 1622502000000;
    jest.spyOn(Date, "now").mockReturnValue(mayThirtyOne2021);

    const handler = new CreateAuthCodeHandler();
    const result = await handler.handler({govuk_signin_journey_id: "test-government-journey-id"}, {} as Context);
    const mayThirtyOne2021Plus10MinsInSeconds = 1622502600;

    expect(result).toEqual({
      authCodeExpiry: mayThirtyOne2021Plus10MinsInSeconds,
    });
  });
});
