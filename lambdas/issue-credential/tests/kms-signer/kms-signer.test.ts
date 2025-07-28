import { KMSClient } from "@aws-sdk/client-kms";
import { signJwt } from "../../src/kms-signer/kms-signer";
import sigFormatter from "ecdsa-sig-formatter";
import { SignerPayLoad } from "../../src/kms-signer/types/signer-payload";
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

jest.spyOn(kmsClient, "send");
jest.mock("jose", () => ({
  base64url: {
    encode: jest.fn().mockImplementation((args) => args),
  },
}));

describe("KmsSigner", () => {
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
        const signedJwt = await signJwt(kmsClient, payload);

        expect(signedJwt).toEqual(`${JSON.stringify(jwtHeader)}.${JSON.stringify(claimsSet)}.${joseSignature}`);
      });

      it("doesn't format KID header if no KID is present", async () => {
        const jwtHeader = {
          type: "JWT",
          alg: "ES256",
        };

        const signedJwt = await signJwt(kmsClient, {
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

        const signedJwt = await signJwt(kmsClient, payload);

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

        const signedJwt = await signJwt(kmsClient, largePayload);

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

      await expect(signJwt(kmsClient, payload)).rejects.toThrow(
        "KMS signing error: KMS response does not contain a valid Signature."
      );
    });

    it.each([
      {
        description: "Should fail when key ID is missing",
        error: new Error(
          "ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null"
        ),
        expectedMessage:
          "KMS signing error: ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null",
      },
      {
        description: "Should throw an error if KMS response is not in JSON format",
        error: new SyntaxError("Unknown error"),
        expectedMessage: "KMS response is not in JSON format. Unknown error",
      },
      {
        description: "Should throw an error for an unknown error during signing with KMS",
        error: { Signature: "invalid-response" },
        expectedMessage: "KMS signing error: [object Object]",
      },
    ])("$description", async ({ error, expectedMessage }) => {
      const payload: Partial<SignerPayLoad> = {
        header: JSON.stringify(header),
        claimsSet: JSON.stringify(claimsSet),
      };

      kmsClient.send.mockImplementationOnce(() => Promise.reject(error));

      await expect(signJwt(kmsClient, payload as SignerPayLoad)).rejects.toThrow(expectedMessage);
    });
  });
});
