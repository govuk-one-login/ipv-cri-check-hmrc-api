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
        validityScore: 2,
        checkDetails: [
          {
            checkMethod: "data",
            identityCheckPolicy: "published",
          },
        ],
        txn: "3f1d3bb5-c688-4b45-a383-25e676274dfa",
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
    },
    type: ["VerifiableCredential", "IdentityCheckCredential"],
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
    ],
  },
  sub: "urn:fdc:gov.uk:2022:dbfac0ed-3e0a-4009-a480-cc4c21f92758",
  nbf: 1709734310,
  iss: "https://review-hc.dev.account.gov.uk",
  exp: 1709741510,
  jti: "urn:uuid:3fbbd30a-412e-42e8-b2e4-29695f8746b3",
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
