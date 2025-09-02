import { environment } from "../env-variables";

let endpointURL: string;

jest.setTimeout(30_000);

describe("/.well-known/jwks.json", () => {
  beforeAll(async () => {
    endpointURL = `https://${process.env.PUBLIC_API}.execute-api.eu-west-2.amazonaws.com/${environment}/.well-known/jwks.json`;
  });

  it("should contain public JWK key set", async () => {
    const response = await fetch(endpointURL, {
      method: "GET",
    });

    const status = response.status;
    const body = await response.json();

    expect(status).toEqual(200);
    expect(body.keys).toBeDefined();
    expect(body.keys.length).toBeGreaterThan(0);

    expect(body.keys[0].kty).toEqual("RSA");
    expect(body.keys[0].n).toBeDefined();
    expect(body.keys[0].use).toEqual("enc");
    expect(body.keys[0].kid).toBeDefined();
    expect(body.keys[0].alg).toEqual("RSA-OAEP-256");
  });
});
