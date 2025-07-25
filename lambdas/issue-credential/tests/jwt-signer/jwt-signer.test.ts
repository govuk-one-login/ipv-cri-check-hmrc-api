import { KMSClient } from "@aws-sdk/client-kms";
import { JwtSigner } from "../../src/jwt-signer/jwt-signer";
import sigFormatter from "ecdsa-sig-formatter";
import { SignerPayLoad } from "../../src/jwt-signer/signer-payload";
import {
  claimsSet,
  header,
  joseLargeClaimsSetSignature,
  joseSignature,
  kid,
  jwtHeader,
  largeClaimsSet,
} from "./test-data";

const kmsClient = jest.mocked(KMSClient).prototype;
const jwtSigner = new JwtSigner(kmsClient);

jest.spyOn(kmsClient, "send");
jest.mock("jose", () => ({
  base64url: {
    encode: jest.fn().mockImplementation((args) => args),
  },
}));

describe("JwtSigner", () => {
  describe("Successfully signs a JWT", () => {
    const payload: SignerPayLoad = {
      kid,
      header: JSON.stringify(header),
      claimsSet: JSON.stringify(claimsSet),
    };

    describe("KID header", () => {
      beforeEach(() => {
        kmsClient.send.mockImplementationOnce(() =>
          Promise.resolve({
            Signature: sigFormatter.joseToDer(joseSignature, "ES256"),
          })
        );
      });

      it("formats KID header if a KID is present", async () => {
        const signedJwt = await jwtSigner.signJwt(payload);

        expect(signedJwt).toEqual(`${JSON.stringify(jwtHeader)}.${JSON.stringify(claimsSet)}.${joseSignature}`);
      });

      it("doesn't format KID header if no KID is present", async () => {
        const jwtHeader = {
          type: "JWT",
          alg: "ES256",
        };

        const signedJwt = await jwtSigner.signJwt({
          ...payload,
          header: JSON.stringify({ ...header, kid: undefined }),
        });

        expect(signedJwt).toEqual(`${JSON.stringify(jwtHeader)}.${JSON.stringify(claimsSet)}.${joseSignature}`);
      });
    });

    describe("With RAW signing mode", () => {
      it("Should verify a signed JWT message smaller than 4096", async () => {
        kmsClient.send.mockImplementationOnce(() =>
          Promise.resolve({
            Signature: sigFormatter.joseToDer(joseSignature, "ES256"),
          })
        );

        const signedJwt = await jwtSigner.signJwt(payload);

        expect(kmsClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              MessageType: "RAW",
            }),
          })
        );
        expect(signedJwt).toEqual(`${JSON.stringify(jwtHeader)}.${JSON.stringify(claimsSet)}.${joseSignature}`);
      });
    });

    describe("Using DIGEST signing mode", () => {
      it("Should verify a large signed JWT with claimset greater than 4096", async () => {
        const largePayload: SignerPayLoad = {
          kid,
          header: JSON.stringify(header),
          claimsSet: JSON.stringify(largeClaimsSet),
        };
        kmsClient.send.mockImplementationOnce(() =>
          Promise.resolve({
            Signature: sigFormatter.joseToDer(joseLargeClaimsSetSignature, "ES256"),
          })
        );

        const signedJwt = await jwtSigner.signJwt(largePayload);

        expect(kmsClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              MessageType: "DIGEST",
            }),
          })
        );
        expect(signedJwt).toEqual(
          `${JSON.stringify(jwtHeader)}.${JSON.stringify(largeClaimsSet)}.${joseLargeClaimsSetSignature}`
        );
      });
    });
  });

  describe("Fails to sign a JWT", () => {
    it("Should error when signature is undefined", async () => {
      const payload: SignerPayLoad = {
        kid,
        header: JSON.stringify(header),
        claimsSet: JSON.stringify(claimsSet),
      };

      kmsClient.send.mockImplementationOnce(() =>
        Promise.resolve({
          Signature: undefined,
        })
      );

      await expect(jwtSigner.signJwt(payload)).rejects.toThrow(
        "KMS signing error: Error: KMS response does not contain a valid Signature."
      );
    });

    it("Should fail when key ID is missing", async () => {
      const payload: Partial<SignerPayLoad> = {
        header: JSON.stringify(header),
        claimsSet: JSON.stringify(claimsSet),
      };

      kmsClient.send.mockImplementationOnce(() =>
        Promise.reject(
          new Error(
            "ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null"
          )
        )
      );

      await expect(jwtSigner.signJwt(payload as SignerPayLoad)).rejects.toThrow(
        "KMS signing error: Error: ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null"
      );
    });

    it("Should throw an error if KMS response is not in JSON format", async () => {
      const payload: Partial<SignerPayLoad> = {
        header: JSON.stringify(header),
        claimsSet: JSON.stringify(claimsSet),
      };

      kmsClient.send.mockImplementationOnce(() => Promise.reject(new SyntaxError("Unknown error")));

      await expect(jwtSigner.signJwt(payload as SignerPayLoad)).rejects.toThrow(
        "KMS response is not in JSON format. SyntaxError: Unknown error"
      );
    });

    it("Should throw an error for an unknown error during signing with KMS", async () => {
      const payload: Partial<SignerPayLoad> = {
        header: JSON.stringify(header),
        claimsSet: JSON.stringify(claimsSet),
      };

      kmsClient.send.mockImplementationOnce(() => Promise.reject({ Signature: "invalid-response" }));

      await expect(jwtSigner.signJwt(payload as SignerPayLoad)).rejects.toThrow(
        "An unknown error occurred while signing with KMS: [object Object]"
      );
    });
  });
});
