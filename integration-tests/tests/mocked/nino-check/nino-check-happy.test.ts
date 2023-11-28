import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

let sfnContainer: SfnContainerHelper;

beforeAll(async () => (sfnContainer = new SfnContainerHelper()));
afterAll(async () => sfnContainer.shutDown());

it("has a step-function docker container running", async () => {
  expect(sfnContainer.getContainer()).toBeDefined();
});

it.each([
  ["with no previous attempt", "HappyPathTestNoPreviousAttempt"],
  ["after 1 failed previous attempt", "HappyPathTestOn2ndAttempt"],
])("should succeed when called %s", async (_, happyPath: string) => {
  const input = JSON.stringify({
    nino: "AA000003D",
    sessionId: "12345",
  });

  const responseStepFunction = await sfnContainer.startStepFunctionExecution(
    happyPath,
    input
  );

  const results = await sfnContainer.waitFor(
    (event: HistoryEvent) =>
      event?.stateExitedEventDetails?.name === "Nino check successful",
    responseStepFunction
  );

  expect(results[0].stateExitedEventDetails?.output).toEqual("{}");
});
