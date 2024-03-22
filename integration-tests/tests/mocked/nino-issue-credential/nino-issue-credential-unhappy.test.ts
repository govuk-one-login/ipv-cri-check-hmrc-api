import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(60_000);

const decode = (value: string) =>
  Buffer.from(value, "base64").toString("utf-8");

const expectedPayload = {
  vc: {
    evidence: [
      {
        type: "IdentityCheck",
        strengthScore: 2,
        validityScore: 2,
        checkDetails: [
          {
            checkMethod: "data",
          },
        ],
        txn: "65ae19f5-8b4f-46d5-88cd-517adca2f1c0",
      },
    ],
    credentialSubject: {
      socialSecurityRecord: [
        {
          personalNumber: "AA000003D",
        },
      ],
      name: [
        {
          nameParts: [
            {
              type: "GivenName",
              value: "KENNETH",
            },
            {
              type: "FamilyName",
              value: "DECERQUEIRA",
            },
          ],
        },
      ],
      birthDate: [
        {
          value: "1965-07-08",
        },
      ],
    },
    type: ["VerifiableCredential", "IdentityCheckCredential"],
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
    ],
  },
  sub: "urn:fdc:gov.uk:2022:05705016-4494-4794-8d7d-7a1e2516af56",
  nbf: 1710396563,
  iss: "https://review-hc.dev.account.gov.uk",
  exp: 1710403763,
  jti: "urn:uuid:f540b78c-9e52-4a0f-b033-c78e7ab327ea",
}

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
    ).output.jwt.split(".");

    const payload = JSON.parse(decode(payloadEncoded));
    expect(payload).toEqual(expectedPayload);
  });
});
