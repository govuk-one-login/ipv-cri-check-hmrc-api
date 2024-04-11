import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(60_000);

const decode = (value: string) =>
  Buffer.from(value, "base64").toString("utf-8");

const expectedPayload = {
  exp: 1725984858,
  iss: "https://review-hc.staging.account.gov.uk",
  jti: "urn:uuid:13838a2c-27ca-4f0e-bce3-7ef1ece222e3",
  nbf: 1710432858,
  sub: "urn:fdc:gov.uk:2022:a4df35ea-4f30-416f-94ad-0221a227d97d",
  vc: {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
    ],
    credentialSubject: {
      birthDate: [{ value: "1970-01-01" }],
      name: [
        {
          nameParts: [
            { type: "GivenName", value: "Jim" },
            { type: "FamilyName", value: "Ferguson" },
          ],
        },
      ],
      socialSecurityRecord: [{ personalNumber: "AA000003D" }],
    },
    evidence: [
      {
        ci: [],
        failedCheckDetails: [{ checkMethod: "data" }],
        strengthScore: 2,
        txn: "ab1733ee-bd7c-4545-bd65-56bf937396d1",
        type: "IdentityCheck",
        validityScore: 0,
      },
    ],
    type: ["VerifiableCredential", "IdentityCheckCredential"],
  },
};
describe("nino-issue-credential-unhappy", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  it("should return 400 when Bearer token is Invalid", async () => {
    const input = JSON.stringify({
      bearerToken: "Bearer",
    });

    const responseStepFunction = await sfnContainer.startStepFunctionExecution(
      "UnHappyPathBearerTokenInvalid",
      input
    );
    const results = await sfnContainer.waitFor(
      (event: HistoryEvent) =>
        event?.type === "PassStateExited" &&
        event?.stateExitedEventDetails?.name === "Err: Invalid Bearer Token",
      responseStepFunction
    );

    expect(results[0].stateExitedEventDetails?.output).toBe(
      '{"error":"Invalid Bearer Token","httpStatus":400}'
    );
  });

  it("should create signed JWT with Ci when nino check is unsuccessful", async () => {
    const input = JSON.stringify({
      bearerToken: "Bearer happy",
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

    const [, payloadEncoded] = JSON.parse(
      results[0].stateExitedEventDetails?.output as string
    ).jwt.split(".");

    const payload = JSON.parse(decode(payloadEncoded));
    expect(payload).toEqual(expectedPayload);
  });
});
