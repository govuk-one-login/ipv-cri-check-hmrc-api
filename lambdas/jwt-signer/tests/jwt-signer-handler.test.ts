import { KMSClient } from "@aws-sdk/client-kms";
import { JwtSignerHandler } from "../src/jwt-signer-handler";
import sigFormatter from "ecdsa-sig-formatter";
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
} from "../src/test-data";

const kmsClient = jest.mocked(KMSClient).prototype;
const jwtSignerHandler = new JwtSignerHandler(kmsClient);

jest.spyOn(kmsClient, "send");

describe("Successfully signs a JWT", () => {
  describe("With RAW signing mode", () => {
    it("Should verify a signed JWT message smaller than 4096", async () => {
      const event: SignerPayLoad = { kid, header, claimsSet };

      kmsClient.send.mockImplementationOnce(() =>
        Promise.resolve({
          Signature: sigFormatter.joseToDer(joseSignature, "ES256"),
        })
      );

      const signature = await jwtSignerHandler.handler(event, {});

      const { payload } = await jwtVerify(
        `${header}.${claimsSet}.${signature}`,
        await importJWK(publicVerifyingJwk, "ES256"),
        {
          algorithms: ["ES256"],
        }
      );

      expect(signature).toBeDefined();

      expect(kmsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MessageType: "RAW",
          }),
        })
      );

      expect(payload).toStrictEqual(
        JSON.parse(Buffer.from(event.claimsSet, "base64").toString())
      );
    });
  });

  describe("Using DIGEST signing mode", () => {
    it("Should verify a large signed JWT with claimset greater than 4096", async () => {
      const event: SignerPayLoad = { kid, header, claimsSet: largeClaimsSet };

      kmsClient.send.mockImplementationOnce(() =>
        Promise.resolve({
          Signature: sigFormatter.joseToDer(
            joseLargeClaimsSetSignature,
            "ES256"
          ),
        })
      );

      const signature = await jwtSignerHandler.handler(event, {});

      const { payload } = await jwtVerify(
        `${header}.${event.claimsSet}.${signature}`,
        await importJWK(publicVerifyingJwk, "ES256"),
        {
          algorithms: ["ES256"],
        }
      );

      expect(signature).toBeDefined();

      expect(kmsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MessageType: "DIGEST",
          }),
        })
      );

      expect(payload).toStrictEqual(
        JSON.parse(Buffer.from(event.claimsSet, "base64").toString())
      );
    });
  });
});

describe("Fails to sign a JWT", () => {
  it("Should error when signature is undefined", async () => {
    const event: SignerPayLoad = { kid, header, claimsSet };

    kmsClient.send.mockImplementationOnce(() =>
      Promise.resolve({
        Signature: undefined,
      })
    );

    await expect(jwtSignerHandler.handler(event, {})).rejects.toThrow(
      "KMS response does not contain a valid Signature."
    );
  });

  it("Should fail when key ID is missing", async () => {
    const event: Partial<SignerPayLoad> = { header, claimsSet };

    kmsClient.send.mockImplementationOnce(() =>
      Promise.reject(
        new Error(
          "ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null"
        )
      )
    );

    await expect(
      jwtSignerHandler.handler(event as SignerPayLoad, {})
    ).rejects.toThrow(
      "ValidationException: 1 validation error detected: Value null at 'keyId' failed to satisfy constraint: Member must not be null"
    );
  });

  it("Should throw an error if KMS response is not in JSON format", async () => {
    const event: Partial<SignerPayLoad> = { header, claimsSet };

    kmsClient.send.mockImplementationOnce(() =>
      Promise.reject(new Error("Unknown error"))
    );

    await expect(
      jwtSignerHandler.handler(event as SignerPayLoad, {})
    ).rejects.toThrow("Unknown error");
  });

  it("should throw due to the signature with an invalid format", async () => {
    const event: Partial<SignerPayLoad> = { header, claimsSet };

    kmsClient.send.mockImplementationOnce(() =>
      Promise.resolve({ Signature: new Uint8Array() })
    );

    await expect(
      jwtSignerHandler.handler(event as SignerPayLoad, {})
    ).rejects.toThrow('Could not find expected "seq"');
  });
});
