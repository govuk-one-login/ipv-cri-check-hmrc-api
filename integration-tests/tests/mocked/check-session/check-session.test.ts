import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

let sfnContainer: SfnContainerHelper;

beforeAll(async () => (sfnContainer = new SfnContainerHelper()));
afterAll(async () => sfnContainer.shutDown());

it("has a step-function docker container running", async () => {
  expect(sfnContainer.getContainer()).toBeDefined();
});

describe("happy path tests", () => {
  it("it should pass when session exists and is not expired", async () => {
    const input = JSON.stringify({
      sessionId: "12345",
    });

    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "HappyPath",
      input
    );

    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name === "Session OK",
      responseStepFunction
    );

    expect(results[0].stateExitedEventDetails?.output).toEqual(
      '{"status":"SESSION_OK"}'
    );
  });
});

describe("unhappy path tests", () => {
  it("it should fail when session does not exist", async () => {
    const input = JSON.stringify({
      sessionId: "12345",
    });

    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "NoSessionFound",
      input
    );

    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name === "Err: No session found",
      responseStepFunction
    );

    expect(results[0].stateExitedEventDetails?.output).toEqual(
      '{"status":"SESSION_NOT_FOUND"}'
    );
  });

  it("it should fail when the session has expired", async () => {
    const input = JSON.stringify({
      sessionId: "12345",
    });

    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "SessionExpired",
      input
    );

    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name === "Err: Session Expired",
      responseStepFunction
    );

    expect(results[0].stateExitedEventDetails?.output).toEqual(
      '{"status":"SESSION_EXPIRED"}'
    );
  });

  it("it should fail when no sessionId was provided", async () => {
    const input = JSON.stringify({});
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "SessionExpired",
      input
    );

    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name === "Err: No sessionId provided",
      responseStepFunction
    );

    expect(results[0].stateExitedEventDetails?.output).toEqual(
      '{"status":"SESSION_NOT_PROVIDED"}'
    );
  });
});
