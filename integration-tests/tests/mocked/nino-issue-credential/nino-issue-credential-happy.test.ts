import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(30_000);

const decode = (value: string) =>
  Buffer.from(value, "base64").toString("utf-8");

const expectedPayload = {
  vc: {
    evidence: [
      {
        type: "IdentityCheck",
        strengthScore: 2,
        validityScore: 0,
        failedCheckDetails: [
          {
            checkMethod: "data",
          },
        ],
        ci: ["N01"],
        txn: "d3bae729-127e-4a1a-be5b-0dcec68f9dc9",
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
              value: "Jim",
            },
            {
              type: "FamilyName",
              value: "Ferguson",
            },
          ],
        },
      ],
    },
    type: ["VerifiableCredential", "IdentityCheckCredential"],
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
    ],
  },
  sub: "test",
  nbf: 1709560618,
  iss: "0976c11e-8ef3-4659-b7f2-ee0b842b85bd",
  exp: 1709567818,
  jti: "urn:uuid:27dd61c4-b91e-4cb8-9c14-65e22d164b1e",
};

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

    const [, payloadEncoded] = JSON.parse(
      results[0].stateExitedEventDetails?.output as string
    ).jwt.split(".");

    const payload = JSON.parse(decode(payloadEncoded));
    expect(payload).toEqual(expectedPayload);
  });
});
