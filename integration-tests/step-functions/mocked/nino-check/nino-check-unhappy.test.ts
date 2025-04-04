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

  it("should succeed on the users last attempt", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "ShouldSuccessOnLastAttempt",
      input
    );
    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) => event?.type === "ExecutionSucceeded",
      responseStepFunction
    );
    expect(results[0].executionSucceededEventDetails?.output).toBe(
      '{"httpStatus":200,"body":"{\\"requestRetry\\":false}"}'
    );
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
      '{"httpStatus":200,"body":"{\\"requestRetry\\":true}"}'
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
    expect(
      JSON.parse(results[0].stateExitedEventDetails?.output || "")
    ).toStrictEqual({
      httpStatus: 200,
      body: '{"requestRetry":false}',
    });
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
      '{"httpStatus":200,"body":"{\\"requestRetry\\":true}"}'
    );
  });

  it("should fail when the call matching api lambda fails after exponential retries", async () => {
    const input = JSON.stringify({
      nino: "AA000003D",
      sessionId: "12345",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "APIFailRetryFailTest",
      input
    );

    const results = await sfnContainer.waitFor(
      (_) => true,
      responseStepFunction
    );

    const retry1 = results[results.length - 4];
    const retry2 = results[results.length - 3];
    const retry3 = results[results.length - 2];

    expect(retry1.taskFailedEventDetails?.error).toBe(
      "InternalServerException"
    );
    expect(retry2.stateExitedEventDetails?.output).toBe(
      '{"Error":"InternalServerException","Cause":"dummy-cause"}'
    );
    expect(retry3.stateEnteredEventDetails?.name).toBe(
      "Err: Matching Lambda Exception"
    );

    expect(results[results.length - 1].type).toBe("ExecutionFailed");
  });
});
