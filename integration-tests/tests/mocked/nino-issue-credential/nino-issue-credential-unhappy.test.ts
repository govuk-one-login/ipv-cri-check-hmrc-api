import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(30_000);

describe("nino-issue-credential-unhappy", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  it("should fail when nino check is unsuccessful", async () => {
    const input = JSON.stringify({
      bearerToken: "Bearer test",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "UnHappyPath",
      input
    );
    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name === "Create Signed JWT",
      responseStepFunction
    );

    const token = JSON.parse(
      results[0].stateExitedEventDetails?.output as never
    );

    const [, payloadEncoded] = token.jwt.split(".");

    const payload = JSON.parse(atob(payloadEncoded));
    const evidence = payload.vc.evidence[0];
    expect(evidence.type).toBe("IdentityCheck");
    expect(evidence.strengthScore).toBe(2);
    expect(evidence.validityScore).toBe(0);
    expect(evidence.failedCheckDetails[0].checkMethod).toBe("data");
    expect(evidence.ci[0]).toBe("D02");
    expect(evidence.txn).not.toBeNull;
  });
});
