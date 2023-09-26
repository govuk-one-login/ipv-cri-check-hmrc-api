import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(30_000);

describe("nino-check-unhappy", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  describe("testing invalid state machine input", () => {
    it("should fail when there are more than two check attempts", async () => {
      const input = JSON.stringify({
        nino: "AA000003D",
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution(
          "MaximumNumberOfAttemptsExceeded",
          input
        );
      const results = await sfnContainer.waitFor(
        (event: HistoryEvent) =>
          event?.type === "PassStateExited" &&
          event?.stateExitedEventDetails?.name === "Err: Attempts exceeded",
        responseStepFunction
      );
      expect(results[0].stateExitedEventDetails?.output).toEqual(
        '{"error":"Maximum number of attempts exceeded"}'
      );
    });

    it("should fail when user cannot be found for the given nino", async () => {
      const input = JSON.stringify({
        nino: "AA000003D",
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution(
          "UserNotFoundForGivenNino",
          input
        );
      const results = await sfnContainer.waitFor(
        (event: HistoryEvent) =>
          event?.type === "PassStateExited" &&
          event?.stateExitedEventDetails?.name === "Err: No user for nino",
        responseStepFunction
      );
      expect(results[0].stateExitedEventDetails?.output).toEqual(
        '{"error":"No user found for given nino"}'
      );
    });
  });
  describe("testing Matching API error paths", () => {
    xit("should fail when HMRC responds back with an API error");
    xit("should fail when HMRC responds back with an exception");
    xit("should fail when HMRC responds back with an authentication error", async () => {
      const input = JSON.stringify({
        nino: "AA000003D",
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("HMRCAuthError", input);
      const results = await sfnContainer.waitFor(
        (event: HistoryEvent) => event?.type === "FailStateEntered",
        responseStepFunction
      );
      expect(results[0].stateExitedEventDetails?.output).toEqual(
        '{"Cause":"Invalid Authentication information provided"}'
      );
    });
  });
});
