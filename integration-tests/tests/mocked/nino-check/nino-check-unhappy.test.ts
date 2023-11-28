import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(60_000);

let sfnContainer: SfnContainerHelper;

beforeAll(async () => (sfnContainer = new SfnContainerHelper()));
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
    '{"error":"Session is not valid or has expired"}'
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
    '{"error":"Maximum number of attempts exceeded"}'
  );
});

it("should fail when there is an error while saving details in Nino DB", async () => {
  const input = JSON.stringify({
    nino: "AA000003D",
    sessionId: "12345",
  });

  const responseStepFunction = await sfnContainer.startStepFunctionExecution(
    "ErrorSavingInNinoDB",
    input
  );

  const results = await sfnContainer.waitFor(
    (event: HistoryEvent) => event?.type === "ExecutionFailed",
    responseStepFunction
  );

  expect(results[0].executionFailedEventDetails?.cause).toContain(
    "The conditional request failed (Service: AmazonDynamoDBv2; Status Code: 400"
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
      event?.stateExitedEventDetails?.name === "Err: No user for nino",
    responseStepFunction
  );

  expect(results[0].stateExitedEventDetails?.output).toEqual(
    '{"error":"No user found for given nino"}'
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

  expect(results[0].executionFailedEventDetails?.cause).toEqual(
    "Invalid Authentication information provided"
  );
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
    '{"error":"CID returned no record"}'
  );
});
