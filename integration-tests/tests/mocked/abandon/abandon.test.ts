import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(60_000);

describe("abandon", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  describe("happy path tests", () => {
    it("it should pass when session exists", async () => {
      const input = JSON.stringify({
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const results = await sfnContainer.waitFor(
        (event: HistoryEvent) => event?.type == "ExecutionSucceeded",
        responseStepFunction
      );
      expect(results[0].executionSucceededEventDetails?.output).toBe("{}");
    });
  });

  describe("unhappy path tests", () => {
    it("it should fail when session does not exist", async () => {
      const input = JSON.stringify({
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("NoSessionFound", input);
      const results = await sfnContainer.waitFor(
        (event: HistoryEvent) =>
          event?.type === "PassStateExited" &&
          event?.stateExitedEventDetails?.name === "Err: Invalid Session",
        responseStepFunction
      );
      expect(results[0].stateExitedEventDetails?.output).toBe(
        '{"httpStatus":400}'
      );
    });
  });
});
