import { getSSMParameter } from "../../step-functions/aws/resources/ssm-param-helper";
import { Payload, getJarAuthorizationPayload } from "../aws/crypto/create-jar-request-payload";
import { PRIVATE_API } from "../aws/test-data";

let publicEncryptionKeyBase64: string;
let privateSigningKey: any;

const environment = process.env.Environment || "dev";

export const createPayload = async () => {

        publicEncryptionKeyBase64 = await getSSMParameter("/check-hmrc-cri-api/test/publicEncryptionKeyBase64") || "";
        privateSigningKey = JSON.parse(await getSSMParameter("/check-hmrc-cri-api/test/privateSigningKey") || "");

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

              const payload = {
                clientId: 'ipv-core-stub-aws-prod',
                audience: `https://review-hc.${environment}.account.gov.uk`,
                authorizationEndpoint: `https://review-hc.${environment}.account.gov.uk/oauth2/authorize`,
                redirectUrl: 'https://cri.core.stubs.account.gov.uk/callback',
                publicEncryptionKeyBase64: publicEncryptionKeyBase64,
                privateSigningKey: privateSigningKey,
                issuer: 'https://cri.core.stubs.account.gov.uk',
                claimSet:  claimSet
              } as Payload;
              const ipvCoreAuthorizationUrl = await getJarAuthorizationPayload(payload);
              return ipvCoreAuthorizationUrl
            }

export const createSession = async (
): Promise<Response> => {
    const ipvCoreAuthorizationUrl = await createPayload()
    const sessionApiUrl = `https://${PRIVATE_API}.execute-api.eu-west-2.amazonaws.com/localdev/session`;
        const sessionResponse = await fetch(sessionApiUrl, {
            method: "POST", 
            headers: {
                "Content-Type": "application/json",
                "X-Forwarded-For": "localhost"
            }, 
            body: JSON.stringify(ipvCoreAuthorizationUrl) 
        })
    
        return sessionResponse
   
    };

export const checkEndpoint = async ( sessionId: string, nino: string
    ): Promise<Response> => {
      const checkApiUrl = `https://${PRIVATE_API}.execute-api.eu-west-2.amazonaws.com/localdev/check`;
      const jsonData = JSON.stringify({ nino : nino })
      const checkResponse = await fetch(checkApiUrl, {
          method: "POST", 
          headers: {
              "Content-Type": "application/json",
              "session-id": sessionId
          }, 
          body: jsonData
      })
  
      return checkResponse
    }

    export const authorizationEndpoint = async ( sessionId: string, client_id: string, redirect_uri: string, state: string 
        ): Promise<Response> => {
            const queryParams = {
                client_id: client_id,
                redirect_uri: redirect_uri,
                response_type: "code",
                state: state,
                scope: "openid"
                };
                const queryString = new URLSearchParams(queryParams);

          const authApiUrl = `https://${PRIVATE_API}.execute-api.eu-west-2.amazonaws.com/localdev/authorization?${queryString}`;
          const authResponse = await fetch(authApiUrl, {
            method: "GET", 
            headers: {
                "Content-Type": "application/json",
                "session-id": sessionId
            }
          })
      
          return authResponse
        }

        export const abandonEndpoint = async ( sessionId: string
          ): Promise<Response> => {
            const abandonUrl = `https://${PRIVATE_API}.execute-api.eu-west-2.amazonaws.com/localdev/abandon`;
            const abandonResponse = await fetch(abandonUrl, {
                method: "POST", 
                headers: {
                    "Content-Type": "application/json",
                    "session-id": sessionId
                }
            })
            return abandonResponse
          }