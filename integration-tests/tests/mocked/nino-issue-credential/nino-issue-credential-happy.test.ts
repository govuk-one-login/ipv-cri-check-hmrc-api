import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(30_000);

describe("nino-issue-credential-happy", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  it("should create signed JWT when nino check is successful", async () => {
    const input = JSON.stringify({
      bearerToken: "Bearer test",
    });
    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "HappyPath",
      input
    );
    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name === "Create Signed JWT",
      responseStepFunction
    );
    expect(results[0].stateExitedEventDetails?.output).toEqual(
      '{"jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6IjA5NzZjMTFlLThlZjMtNDY1OS1iN2YyLWVlMGI4NDJiODViZCJ9.eyJ2YyI6eyJldmlkZW5jZSI6W3sidHlwZSI6IklkZW50aXR5Q2hlY2siLCJzdHJlbmd0aFNjb3JlIjoyLCJ2YWxpZGl0eVNjb3JlIjoyLCJjaGVja0RldGFpbHMiOlt7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImlkZW50aXR5Q2hlY2tQb2xpY3kiOiJwdWJsaXNoZWQifV0sInR4biI6ImM4ODFjMzY5LTQ4ZTktNDIxOS1iZTg1LWYyMzZlNTJhMDg4MCJ9XSwiY3JlZGVudGlhbFN1YmplY3QiOnsic29jaWFsU2VjdXJpdHlSZWNvcmQiOlt7InBlcnNvbmFsTnVtYmVyIjoiQUEwMDAwMDNEIn1dLCJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkppbSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IkZlcmd1c29uIn1dfV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInN1YiI6InRlc3QiLCJuYmYiOjE2OTk5NjQ5NTYxMzEsImlzcyI6IjA5NzZjMTFlLThlZjMtNDY1OS1iN2YyLWVlMGI4NDJiODViZCIsImV4cCI6MTY5OTk3MjE1NjEzMSwianRpIjoidXJuOnV1aWQ6OGUyYjVlZTEtM2NmZC00MTQ2LWExZjItMzhjNDJlOTIzNzQ5In0=.MEYCIQA/Pzw/Pz8pPz9zPzEpPz92KiQ/P0g/VkxLWz8/OjQECgIhAD8BPzI/Pxg/eT8/ZD8oPz5kCC4/Kz8/P34/WT8XPyc/"}'
    );
  });
});
