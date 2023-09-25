import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(30_000);

describe("step-function-local", () => {
  describe("HMRC Nino Check", () => {
    let stnContainerHelper: SfnContainerHelper;
    describe("is successful", () => {
      beforeAll(async () => {
        stnContainerHelper = new SfnContainerHelper();
      });
      afterAll(async () => stnContainerHelper.shutDown());
      it("has a container is running", async () => {
        expect(stnContainerHelper.getContainer()).toBeDefined();
      });

      describe("happy Case Scenario", () => {
        describe("attempts", () => {
          it.each([
            ["with no previous attempt", "HappyPathTestNoPreviousAttempt"],
            ["after 1 failed previous attempt", "HappyPathTestOn2ndAttempt"],
          ])("should succeed when called %s", async (_, happyPath: string) => {
            const input = JSON.stringify({
              nino: "AA000003D",
              sessionId: "12345",
            });

            const responseStepFunction =
              await stnContainerHelper.startStepFunctionExecution(
                happyPath,
                input
              );
            const results = await stnContainerHelper.waitFor(
              (event: HistoryEvent) =>
                event?.stateExitedEventDetails?.name ===
                "Nino check successful",
              responseStepFunction
            );

            expect(results[0].stateExitedEventDetails?.output).toEqual("{}");
          });
        });
      });

      describe("non-existent data input", () => {
        it("should fail when there are more than two attempts on a bad nino", async () => {
          const input = JSON.stringify({
            nino: "AA000003D",
            sessionId: "12345",
          });

          const responseStepFunction =
            await stnContainerHelper.startStepFunctionExecution(
              "MaximumNumberOfAttemptsExceeded",
              input
            );
          const results = await stnContainerHelper.waitFor(
            (event: HistoryEvent) =>
              event?.type === "PassStateExited" &&
              event?.stateExitedEventDetails?.name === "Err: Attempts exceeded",
            responseStepFunction
          );

          expect(results[0].stateExitedEventDetails?.output).toEqual(
            '{"error":"Maximum number of attempts exceeded"}'
          );
        });
        it("should fail when user does not exist with the given nino", async () => {
          const input = JSON.stringify({
            nino: "AA000003D",
            sessionId: "12345",
          });

          const responseStepFunction =
            await stnContainerHelper.startStepFunctionExecution(
              "UserNotFoundForGivenNino",
              input
            );
          const results = await stnContainerHelper.waitFor(
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
      xdescribe("Bearer token errors", () => {
        it("should error when token is expired", async () => {});

        it("should error when token doesn't exist", async () => {});
      });
      xdescribe("HMRC Errors", () => {
        describe("SSM parameter errors", () => {
          it("should error when get user agent is not present", () => {});
          it("should throw permission when get user agent", () => {});

          it("should error when get api url is not present", () => {});
          it("should throw permission error when get api url", () => {});
        });
      });
    });
  });
});
