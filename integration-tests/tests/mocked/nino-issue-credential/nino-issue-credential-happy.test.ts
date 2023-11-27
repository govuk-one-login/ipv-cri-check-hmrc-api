import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(30_000);

const decode = (value: string) =>
  Buffer.from(value, "base64").toString("utf-8");

const expectedPayload = {
  iss: "0976c11e-8ef3-4659-b7f2-ee0b842b85bd",
  jti: expect.any(String),
  sub: "test",
  vc: {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
    ],
    credentialSubject: {
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
        checkDetails: [
          { checkMethod: "data", identityCheckPolicy: "published" },
        ],
        strengthScore: 2,
        txn: expect.any(String),
        type: "IdentityCheck",
        validityScore: 2,
      },
    ],
    type: ["VerifiableCredential", "IdentityCheckCredential"],
  },
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
      results[0].stateExitedEventDetails?.output as any
    ).jwt.split(".");

    const payload = JSON.parse(decode(payloadEncoded));
    expect(payload).toEqual(expect.objectContaining(expectedPayload));
  });
});
