import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { createHash } from "crypto";
import sigFormatter from "ecdsa-sig-formatter";
import { fromEnv } from "@aws-sdk/credential-providers";
import { SignerPayLoad } from "./signer-payload";
import { SignageType } from "./signage-type";
import { Logger } from "@aws-lambda-powertools/logger";

import {
  KMSClient,
  MessageType,
  SignCommand,
  SigningAlgorithmSpec,
} from "@aws-sdk/client-kms";

const logger = new Logger();
export class JwtSignerHandler implements LambdaInterface {
  constructor(private kmsClient: KMSClient) {}

  public async handler(
    event: SignerPayLoad,
    _context: unknown
  ): Promise<string> {
    const response = await this.signWithKms(
      event.header,
      event.claimsSet,
      event.kid as string
    );
    return sigFormatter.derToJose(
      Buffer.from(response).toString("base64"),
      "ES256"
    );
  }

  private async signWithKms(
    jwtHeader: string,
    jwtPayload: string,
    KeyId: string
  ): Promise<Uint8Array> {
    const payload = Buffer.from(`${jwtHeader}.${jwtPayload}`);

    const signage: SignageType = this.checkSize(payload)
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error in JwtSignerHandler: ${errorMessage}`);
      throw error;
    }
  }

  private hashInput = (input: Buffer): Uint8Array =>
    createHash("sha256").update(input).digest();

  private checkSize = (message: Buffer): boolean => message.length >= 4096;
}

const handlerClass = new JwtSignerHandler(
  new KMSClient({ region: "eu-west-2", credentials: fromEnv() })
);
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
