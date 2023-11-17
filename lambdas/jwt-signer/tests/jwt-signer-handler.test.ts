import { KMSClient } from "@aws-sdk/client-kms";
import { JwtSignerHandler } from "../src/jwt-signer-handler";
import { Context } from "aws-lambda";
import * as sigFormatter from "ecdsa-sig-formatter";
import { SignerPayLoad } from "../src/signer-payload";
import { importJWK, jwtVerify } from "jose";
import {
  claimsSet,
  header,
  joseLargeClaimsSetSignature,
  joseSignature,
  kid,
  largeClaimsSet,
  publicVerifyingJwk,
} from "./test-data";

let kmsClient: jest.Mocked<KMSClient>;

beforeEach(() => {
  kmsClient = { send: jest.fn() } as unknown as jest.Mocked<KMSClient>;
});

describe("jwt-signer-handler", () => {
  describe("succeed in signing a jwt", () => {
    describe("with RAW signage mode", () => {
      it("should verify a signed jwt message smaller than 4096", async () => {
        const event: SignerPayLoad = { kid, header, claimsSet };
        const jwtSignerHandler = new JwtSignerHandler(kmsClient);
        const signatureBuffer = sigFormatter.joseToDer(joseSignature, "ES256");

        kmsClient.send.mockImplementationOnce(() =>
          Promise.resolve({ Signature: signatureBuffer })
        );

        const signature = await jwtSignerHandler.handler(event, {} as Context);
        const publicSigningVerifyingKey = await importJWK(
          publicVerifyingJwk,
          "ES256"
        );

        const { payload } = await jwtVerify(
          `${header}.${claimsSet}.${signature}`,
          publicSigningVerifyingKey,
          {
            algorithms: ["ES256"],
          }
        );

        expect(signature).not.toBeUndefined();
        expect(kmsClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              MessageType: "RAW",
            }),
          })
        );

        expect(payload).toEqual({
          aud: "https://review-a.dev.account.gov.uk",
          client_id: "ipv-core-stub-aws-build",
          exp: 4102444800,
          govuk_signin_journey_id: "84521e2b-43ab-4437-a118-f7c3a6d24c8e",
          iat: 1697516406,
          iss: "https://cri.core.build.stubs.account.gov.uk",
          nbf: 1697516406,
          persistent_session_id: "a67c497b-ac49-46a0-832c-8e7864c6d4cf",
          redirect_uri: "https://cri.core.build.stubs.account.gov.uk/callback",
          response_type: "code",
          scope: "openid",
          shared_claims: {
            "@context": [
              "https://www.w3.org/2018/credentials/v1",
              "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
            ],
            address: [
              {
                addressLocality: "",
                buildingName: "",
                buildingNumber: "",
                postalCode: "",
                streetName: "",
                validFrom: "2021-01-01",
              },
            ],
            birthDate: [{ value: "1948-04-23" }],
            name: [
              {
                nameParts: [
                  { type: "GivenName", value: "Jim" },
                  { type: "FamilyName", value: "Ferguson" },
                ],
              },
            ],
          },
          state: "diWgdrCGYnjrZK7cMPEKwJXvpGn6rvhCBteCl_I2ejg",
          sub: "urn:fdc:gov.uk:2022:0df67954-5537-4c98-92d9-e95f0b2e6f44",
        });
      });
    });

    describe("using DIGEST signing mode", () => {
      it("should verify a large signed jwt with claimset greater than 4096x", async () => {
        const event: SignerPayLoad = { kid, header, claimsSet: largeClaimsSet };
        const jwtSignerHandler = new JwtSignerHandler(kmsClient);
        const signatureBuffer = sigFormatter.joseToDer(
          joseLargeClaimsSetSignature,
          "ES256"
        );

        kmsClient.send.mockImplementationOnce(() =>
          Promise.resolve({ Signature: signatureBuffer })
        );

        const signature = await jwtSignerHandler.handler(event, {} as Context);

        const publicSigningVerifyingKey = await importJWK(
          publicVerifyingJwk,
          "ES256"
        );

        const { payload } = await jwtVerify(
          `${header}.${event.claimsSet}.${signature}`,
          publicSigningVerifyingKey,
          {
            algorithms: ["ES256"],
          }
        );

        expect(signature).not.toBeUndefined();
        expect(kmsClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              MessageType: "DIGEST",
            }),
          })
        );

        expect(payload).toEqual(
          JSON.parse(Buffer.from(event.claimsSet, "base64").toString())
        );
      });
    });
  });

  describe("does not sign a jwt", () => {
    it("should error when signature is undefined", async () => {
      const event: SignerPayLoad = { kid, header, claimsSet };
      const jwtSignerHandler = new JwtSignerHandler(kmsClient);

      kmsClient.send.mockImplementationOnce(() =>
        Promise.resolve({ Signature: undefined })
      );

      await expect(
        jwtSignerHandler.handler(event as SignerPayLoad, {} as Context)
      ).rejects.toThrow(
        "KMS signing error: Error: KMS response does not contain a valid Signature."
      );
    });

    it("should fail when key Id is missing", async () => {
      const event: Partial<SignerPayLoad> = { header, claimsSet };
      const jwtSignerHandler = new JwtSignerHandler(kmsClient);

      kmsClient.send = jest
        .fn()
        .mockReturnValue({
          Signature: new Uint8Array(),
        })
        .mockRejectedValueOnce(
          new Error(
            "ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null"
          )
        );

      await expect(
        jwtSignerHandler.handler(event as SignerPayLoad, {} as Context)
      ).rejects.toThrow(
        "KMS signing error: Error: ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null"
      );
    });

    it("should throw an error if KMS response is not in JSON format", async () => {
      const event: Partial<SignerPayLoad> = { header, claimsSet };
      const jwtSignerHandler = new JwtSignerHandler(kmsClient);

      kmsClient.send = jest
        .fn()
        .mockReturnValue({
          Signature: new Uint8Array(),
        })
        .mockRejectedValueOnce(new SyntaxError("Unknown error"));

      await expect(
        jwtSignerHandler.handler(event as SignerPayLoad, {} as Context)
      ).rejects.toThrow(
        "KMS response is not in JSON format. SyntaxError: Unknown error"
      );
    });

    it("should throw an error for an unknown error during signing with KMS", async () => {
      const event: Partial<SignerPayLoad> = { header, claimsSet };
      const jwtSignerHandler = new JwtSignerHandler(kmsClient);

      kmsClient.send = jest
        .fn()
        .mockReturnValue({
          Signature: new Uint8Array(),
        })
        .mockRejectedValueOnce({ Signature: "invalid-response" });

      await expect(
        jwtSignerHandler.handler(event as SignerPayLoad, {} as Context)
      ).rejects.toThrow(
        "An unknown error occurred while signing with KMS: [object Object]"
      );
    });
  });
});
