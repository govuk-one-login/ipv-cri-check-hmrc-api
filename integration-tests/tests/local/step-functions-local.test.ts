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

            expect(results).toBeDefined();
            expect(results?.length).toBe(1);
            expect(results[0].stateExitedEventDetails?.output).toEqual(
              '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
            );
          });
        });
      });
      describe("Error Scenarios", () => {
        describe("Invalid Request Received", () => {
          it("should fail when session id not present", async () => {
            const input = JSON.stringify({
              nino: "AA000003D",
            });

            const responseStepFunction =
              await stnContainerHelper.startStepFunctionExecution(
                "InValidRequestSessionIdNotPresent",
                input
              );
            const results = await stnContainerHelper.waitFor(
              (event: HistoryEvent) =>
                event?.type === "PassStateExited" &&
                event?.stateExitedEventDetails?.name ===
                  "Error: No sessionId was provided",
              responseStepFunction
            );

            expect(results).toBeDefined();
            expect(results?.length).toBe(1);
            expect(results[0].stateExitedEventDetails?.output).toEqual(
              '{"nino":"AA000003D"}'
            );
            expect(results[0].stateExitedEventDetails?.output).not.toEqual(
              '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
            );
          });
          it("should fail when NINO not present", async () => {
            const input = JSON.stringify({
              sessionId: "12345",
            });

            const responseStepFunction =
              await stnContainerHelper.startStepFunctionExecution(
                "InValidRequestNinoIdNotPresent",
                input
              );
            const results = await stnContainerHelper.waitFor(
              (event: HistoryEvent) =>
                event?.type === "PassStateExited" &&
                event?.stateExitedEventDetails?.name ===
                  "Error: No nino was provided",
              responseStepFunction
            );

            expect(results).toBeDefined();
            expect(results?.length).toBe(1);
            expect(results[0].stateExitedEventDetails?.output).toEqual(
              '{"sessionId":"12345"}'
            );
            expect(results[0].stateExitedEventDetails?.output).not.toEqual(
              '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
            );
          });
        });
      });

      describe("dynamodb error", () => {
        it("should fail when there are more than two attempts", async () => {
          const input = JSON.stringify({
            nino: "AA000003D",
            sessionId: "12345",
          });

          const responseStepFunction =
            await stnContainerHelper.startStepFunctionExecution(
              "MaxiumNumberOfAttemptsExceeded",
              input
            );
          const results = await stnContainerHelper.waitFor(
            (event: HistoryEvent) =>
              event?.type === "PassStateExited" &&
              event?.stateExitedEventDetails?.name ===
                "Error: Maximum number of attempts exceeded",
            responseStepFunction
          );

          expect(results).toBeDefined();
          expect(results?.length).toBe(1);
          expect(results[0].stateExitedEventDetails?.output).toEqual(
            '{"nino":"AA000003D","sessionId":"12345","check-attempts-exist":{"Count":1,"Items":[{"id":{"S":"12345"},"attempts":{"N":"2"}}],"ScannedCount":1}}'
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
              event?.stateExitedEventDetails?.name ===
                "Error: No user for given nino found",
            responseStepFunction
          );

          expect(results).toBeDefined();
          expect(results?.length).toBe(1);
          expect(results[0].stateExitedEventDetails?.output).toEqual(
            '{"nino":"AA000003D","sessionId":"12345","check-attempts-exist":{"Count":0,"Items":[],"ScannedCount":0},"userDetails":{"Count":0,"Items":[],"ScannedCount":0}}'
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
