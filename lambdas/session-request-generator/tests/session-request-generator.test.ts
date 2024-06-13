import { SessionRequestGenerator } from "../src/session-request-generator";

jest.setTimeout(60000);

describe("session-request-generator", () => {
  it("should pass", async () => {
    const handler = new SessionRequestGenerator();
    const result = await handler.handler(
      {
        queryStringParameters: {
          clientId: "ipv-core-stub-aws-prod",
          audience: "https://review-hc.dev.account.gov.uk",
        },
        body: {
          sub: "urn:fdc:gov.uk:2022:0df67954-5537-4c98-92d9-e95f0b2e6f44",
          shared_claims: {
            "@context": [
              "https://www.w3.org/2018/credentials/v1",
              "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
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
            birthDate: [
              {
                value: "1948-04-23",
              },
            ],
            address: [
              {
                buildingNumber: "",
                buildingName: "",
                streetName: "",
                addressLocality: "",
                postalCode: "",
                validFrom: "2021-01-01",
              },
            ],
          },
          iss: "https://cri.core.stubs.account.gov.uk",
          persistent_session_id: "uuidv4()",
          response_type: "code",
          client_id: "ipv-core-stub-aws-prod",
          govuk_signin_journey_id: "uuidv4()",
          aud: "https://review-hc.dev.account.gov.uk",
          redirect_uri: "https://cri.core.stubs.account.gov.uk/callback",
          state: "uuidv4()",
        },
      },
      {}
    );
    console.log(JSON.stringify(result));
    expect(result.statusCode).toEqual(302);
  });
});
