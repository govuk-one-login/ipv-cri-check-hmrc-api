import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(60_000);

describe("check-session", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  xdescribe("happy path tests", () => {
    it("should pass when session exists and is not expired", async () => {
      const input = JSON.stringify({
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("HappyPath", input);
      const results = await sfnContainer.waitFor(
        (event: HistoryEvent) =>
          event?.type === "PassStateExited" &&
          event?.stateExitedEventDetails?.name === "Session OK",
        responseStepFunction
      );
      expect(results[0].stateExitedEventDetails?.output).toBe(
        '{"status":"SESSION_OK","txmaAuditHeader":"{}","sessionExpiry":"2695828259","clientId":"exampleClientId","userAuditInfo":{"govuk_signin_journey_id":"252561a2-c6ef-47e7-87ab-93891a2a6a41","user_id":"urn:fdc:gov.uk:2022:da580c9d-cdf9-4961-afde-233249db04d2","persistent_session_id":"156714ef-f9df-48c2-ada8-540e7bce44f7","session_id":"12345","ip_address":"51.149.8.29"}}'
      );
    });
    it("should pass when a valid session exists and persistent_session_id is absent", async () => {
      const input = JSON.stringify({
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution(
          "HappyPathWithOptionalPersistentSessionId",
          input
        );
      const results = await sfnContainer.waitFor(
        (event: HistoryEvent) =>
          event?.type === "PassStateExited" &&
          event?.stateExitedEventDetails?.name === "Session OK",
        responseStepFunction
      );
      expect(results[0].stateExitedEventDetails?.output).toBe(
        '{"status":"SESSION_OK","txmaAuditHeader":"{}","sessionExpiry":"2695828259","clientId":"exampleClientId","userAuditInfo":{"govuk_signin_journey_id":"252561a2-c6ef-47e7-87ab-93891a2a6a41","user_id":"urn:fdc:gov.uk:2022:da580c9d-cdf9-4961-afde-233249db04d2","session_id":"12345","ip_address":"51.149.8.29"}}'
      );
    });
  });

  xdescribe("unhappy path tests", () => {
    it("should fail when session does not exist", async () => {
      const input = JSON.stringify({
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("NoSessionFound", input);
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
    it("fails when the session has expired", async () => {
      const input = JSON.stringify({
        sessionId: "12345",
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("SessionExpired", input);
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
    it("fails when no sessionId was provided", async () => {
      const input = JSON.stringify({});
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("SessionExpired", input);
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
});
