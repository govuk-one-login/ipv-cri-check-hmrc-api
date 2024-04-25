import { getSSMParameter } from "../resources/ssm-param-helper";
import { stackOutputs } from "../resources/cloudformation-helper";

type EvidenceRequest = {
  scoringPolicy: string;
  strengthScore: number;
};
export const CLIENT_ID = process.env.CLIENTID ?? "ipv-core-stub-aws-prod";
export const CLIENT_URL =
  process.env.CLIENT_URL ?? "https://cri.core.stubs.account.gov.uk";
export const NINO = "AA123456C";
export const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
export const GRANT_TYPE = "authorization_code";
export const environment = process.env.Environment || "localdev";
export const getClaimSet = async () => {
  const CLIENT_ID = process.env.CLIENTID ?? "ipv-core-stub-aws-prod";
  const CLIENT_URL =
    process.env.CLIENT_URL ?? "https://cri.core.stubs.account.gov.uk";
  const output = await stackOutputs(process.env.STACK_NAME);
  const audience =
    (await getSSMParameter(
      `/${output.CommonStackName}/clients/${CLIENT_ID}/jwtAuthentication/audience`
    )) || "";
  const data = {
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
    iss: CLIENT_URL,
    persistent_session_id: "a67c497b-ac49-46a0-832c-8e7864c6d4cf",
    response_type: "code",
    client_id: CLIENT_ID,
    govuk_signin_journey_id: "84521e2b-43ab-4437-a118-f7c3a6d24c8e",
    aud: audience,
    nbf: 1697516406,
    evidence_requested: undefined as unknown as EvidenceRequest,
    redirect_uri: `${CLIENT_URL}/callback`,
    state: "diWgdrCGYnjrZK7cMPEKwJXvpGn6rvhCBteCl_I2ejg",
    exp: Date.now() + 100000000000,
    iat: 1697516406,
  };
  return data;
};
