import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(60_000);

describe("nino-check-unhappy", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  it("should fail when session id is invalid", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "InValidRequestSessionId",
      input
    );
    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) => event?.type === "ExecutionSucceeded",
      responseStepFunction
    );
    expect(results[0].executionSucceededEventDetails?.output).toEqual(
      '{"httpStatus":400}'
    );
  });

  it("should fail when user is deceased is invalid", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "DeceasedTest",
      input
    );
    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) => event?.type === "ExecutionSucceeded",
      responseStepFunction
    );
    expect(results[0].executionSucceededEventDetails?.output).toEqual(
      '{"httpStatus":422}'
    );
  });

  it("should fail when there are more than two check attempts", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
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
      '{"httpStatus":200}'
    );
  });

  it("should fail when user cannot be found for the given nino", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "UserNotFoundForGivenNino",
      input
    );
    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name ===
          "Err: No user found in Person Identity",
      responseStepFunction
    );
    expect(results[0].stateExitedEventDetails?.output).toEqual(
      '{"httpStatus":500}'
    );
  });

  it("should throw an error when url is unavailable", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "MatchingLambdaException",
      input
    );

    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) => event?.type === "ExecutionFailed",
      responseStepFunction
    );
    expect(results[0].executionFailedEventDetails).toEqual({});
  });
  it("should throw an error when token is invalid", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "HMRCAuthError",
      input
    );

    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) => event?.type === "ExecutionFailed",
      responseStepFunction
    );
    expect(results[0].executionFailedEventDetails?.cause).toBe(undefined);
  });

  it("should fail when user nino does not match with HMRC DB", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "HMRCError",
      input
    );

    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) => event?.type === "ExecutionSucceeded",
      responseStepFunction
    );
    expect(results[0].executionSucceededEventDetails?.output).toEqual(
      '{"httpStatus":422}'
    );
  });
});
