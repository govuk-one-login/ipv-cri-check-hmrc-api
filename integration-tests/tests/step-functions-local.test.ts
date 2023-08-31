import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(30_000);

describe("step-function-local", () => {
  describe("HMRC Nino Check", () => {
    let stnContainerHelper: SfnContainerHelper;
    describe("successfully validated", () => {
      beforeAll(async () => {
        stnContainerHelper = new SfnContainerHelper();
      });
      afterAll(async () => stnContainerHelper.shutDown());
      it("has a container is running", async () => {
        expect(stnContainerHelper.getContainer()).toBeDefined();
      });

      describe("happy Case Scenario", () => {
        describe("check is successful", () => {
          it.each([
            [
              "initially with no previous attempt",
              "HappyPathTestNoPreviousAttempt",
            ],
            ["after 1 failed previous attempt", "HappyPathTestOn2ndAttempt"],
          ])(
            "should return validated user details when called %s",
            async (_, happyPath: string) => {
              // GIVEN
              const input = JSON.stringify({
                nino: "AA000003D",
                sessionId: "12345",
              });
              // WHEN
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

              // THEN
              expect(results).toBeDefined();
              expect(results?.length).toBe(1);
              expect(results[0].stateExitedEventDetails?.output).toEqual(
                '{"firstName":"Jim","lastName":"Ferguson","dateOfBirth":"1948-04-23","nino":"AA000003D"}'
              );
            }
          );
        });
      });
      describe("Error Scenarios", () => {
        describe("Invalid Request", () => {
          it("Session id not present", async () => {});
          it("NINO not present", async () => {});
        });
      });

      describe("dynamodb error", () => {
        it("User exceeded max number of attempts", async () => {});
        it("User details not present for NINO", async () => {});
      });

      describe("Bearer token errors", () => {
        it("should error when token is expired", async () => {});

        it("should error when token doesn't exist", async () => {});
      });
      describe("HMRC Errors", () => {
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
