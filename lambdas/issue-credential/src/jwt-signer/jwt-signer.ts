import { createHash } from "crypto";
import sigFormatter from "ecdsa-sig-formatter";
import { SignerPayLoad, SignerHeader } from "./signer-payload";
import { SignageType } from "./signage-type";
import { base64url } from "jose";
import { KMSClient, MessageType, SignCommand, SigningAlgorithmSpec } from "@aws-sdk/client-kms";

export class JwtSigner {
  constructor(private kmsClient: KMSClient) {}

  public async signJwt(payload: SignerPayLoad): Promise<string> {
    const parsedHeader = JSON.parse(payload.header) as SignerHeader;

    if (parsedHeader.kid) {
      parsedHeader.kid = `did:web:${process.env.DOMAIN_NAME}#${this.getHashedKid(parsedHeader.kid)}`;
    }

    const header = base64url.encode(JSON.stringify(parsedHeader));
    const claimsSet = base64url.encode(payload.claimsSet);

    const response = await this.signWithKms(header, claimsSet, payload.kid as string);
    const signature = sigFormatter.derToJose(Buffer.from(response).toString("base64"), "ES256");

    return `${header}.${claimsSet}.${signature}`;
  }

  private async signWithKms(jwtHeader: string, jwtPayload: string, KeyId: string): Promise<Uint8Array> {
    const payload = Buffer.from(`${jwtHeader}.${jwtPayload}`);

    const signage: SignageType = this.isLargeSize(payload)
      ? { message: this.hashInput(payload), type: MessageType.DIGEST }
      : { message: payload, type: MessageType.RAW };

    try {
      const signingResponse = await this.kmsClient.send(
        new SignCommand({
          KeyId,
          Message: signage.message,
          SigningAlgorithm: SigningAlgorithmSpec.ECDSA_SHA_256,
          MessageType: signage.type,
        })
      );
      if (!signingResponse?.Signature) {
        throw new Error("KMS response does not contain a valid Signature.");
      }

      return signingResponse.Signature;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`KMS response is not in JSON format. ${error}`);
      } else if (error instanceof Error) {
        throw new Error(`KMS signing error: ${error}`);
      } else {
        throw new Error(`An unknown error occurred while signing with KMS: ${error}`);
      }
    }
  }

  private hashInput = (input: Buffer): Uint8Array => createHash("sha256").update(input).digest();

  private getHashedKid = (keyId: string): string => {
    const kidBytes = Buffer.from(keyId, "utf8");
    const hash = createHash("sha256").update(kidBytes).digest();
    return Buffer.from(hash).toString("hex");
  };

  private isLargeSize = (message: Buffer): boolean => message.length >= 4096;
}
