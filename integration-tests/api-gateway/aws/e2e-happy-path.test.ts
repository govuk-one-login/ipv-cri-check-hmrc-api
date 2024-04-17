import { getSSMParameter } from "../../step-functions/aws/resources/ssm-param-helper";
import { Payload, getJarAuthorizationPayload } from "./crypto/create-jar-request-payload";
import { PRIVATE_API } from "./test-data";
let data: any;
let state: any;
let authCode: any;
let clientId= 'ipv-core-stub-aws-prod'
let redirect_uri='https://cri.core.stubs.account.gov.uk/callback'

jest.setTimeout(30000)

const environment = process.env.Environment || "dev";

let claimSet = {
  sub: "urn:fdc:gov.uk:2022:0df67954-5537-4c98-92d9-e95f0b2e6f44",
  shared_claims: {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
    ],
    name: [
      {
        nameParts: [
          { type: "GivenName", value: "Jim" },
          { type: "FamilyName", value: "Ferguson" },
        ],
      },
    ],
    birthDate: [{ value: "1948-04-23" }],
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
  persistent_session_id: "a67c497b-ac49-46a0-832c-8e7864c6d4cf",
  response_type: "code",
  client_id: "ipv-core-stub-aws-prod",
  govuk_signin_journey_id: "84521e2b-43ab-4437-a118-f7c3a6d24c8e",
  aud: `https://review-hc.${environment}.account.gov.uk`,
  nbf: 1697516406,
  scope: "openid",
  redirect_uri: "https://cri.core.stubs.account.gov.uk/callback",
  state: "diWgdrCGYnjrZK7cMPEKwJXvpGn6rvhCBteCl_I2ejg",
  exp: Date.now() + 100000000000,
  iat: 1697516406,
};

const createSessionId = async ( ipvCoreAuthorizationUrl: { client_id: any; request: string; } | null
    ): Promise<Response> => {
    const sessionApiUrl = `https://${PRIVATE_API}.execute-api.eu-west-2.amazonaws.com/localdev/session`;
        const sessionResponse = await fetch(sessionApiUrl, {
            method: "POST", 
            headers: {
                "Content-Type": "application/json",
                "X-Forwarded-For": "localhost"
            }, 
            body: JSON.stringify(ipvCoreAuthorizationUrl) 
        })
        data = sessionResponse
        let session = await sessionResponse.json()
        
        console.log ("first session response", session)
        return session
        
    };

describe("Private API Happy Path Tests", () => {
    let session: any;
    let sessionId: any;
    let publicEncryptionKeyBase64: string;
    let privateSigningKey: any;

  beforeAll(async () => {
    publicEncryptionKeyBase64 = await getSSMParameter("/check-hmrc-cri-api/test/publicEncryptionKeyBase64") || "";
    privateSigningKey = JSON.parse(await getSSMParameter("/check-hmrc-cri-api/test/privateSigningKey") || "");
  });

    beforeEach( async () => { 
      const payload = {
        clientId: 'ipv-core-stub-aws-prod',
        audience: `https://review-hc.${environment}.account.gov.uk`,
        authorizationEndpoint: `https://review-hc.${environment}.account.gov.uk/oauth2/authorize`,
        redirectUrl: 'https://cri.core.stubs.account.gov.uk/callback',
        publicEncryptionKeyBase64: publicEncryptionKeyBase64,
        privateSigningKey: privateSigningKey,
        issuer: 'https://cri.core.stubs.account.gov.uk',
        claimSet: claimSet
      } as Payload;
      const ipvCoreAuthorizationUrl = await getJarAuthorizationPayload(payload);
      console.log("ipv core url", ipvCoreAuthorizationUrl)

        session = await createSessionId(ipvCoreAuthorizationUrl)
        sessionId = session.session_id
    }) 

    xit("E2E Happy Path Test", async () => {
      expect(data.status).toEqual(201);
      state = session.state
      console.log("state", state)
    })

    it("E2E Happy Path Test", async () => {
        expect(data.status).toEqual(201);
        state = session.state

        const checkApiUrl = `https://${PRIVATE_API}.execute-api.eu-west-2.amazonaws.com/localdev/check`;
        const jsonData = JSON.stringify({ nino : 'AA123456C' })
       
        const checkResponse = await fetch(checkApiUrl, {
            method: "POST", 
            headers: {
                "Content-Type": "application/json",
                "session-id": sessionId
            }, 
            body: jsonData
        })

        let checkData = checkResponse.status
        expect(checkData).toEqual(200);
        
        const queryParams = {
            client_id: clientId,
            redirect_uri: redirect_uri,
            response_type: "code",
            state: state,
            scope: "openid"
        };
        const queryString = new URLSearchParams(queryParams);

        const authApiUrl = `https://${PRIVATE_API}.execute-api.eu-west-2.amazonaws.com/localdev/authorization?${queryString}`;
        console.log("auth api url", authApiUrl)
        const authResponse = await fetch(authApiUrl, {
          method: "GET", 
          headers: {
              "Content-Type": "application/json",
              "session-id": sessionId
          }
        })
       
        let authData = await authResponse.json();

        expect(authResponse.status).toEqual(200);
        authCode = authData.authorizationCode
    });
});