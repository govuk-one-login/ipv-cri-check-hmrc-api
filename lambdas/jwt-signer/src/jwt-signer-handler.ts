import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { createHash } from "crypto";
import sigFormatter from "ecdsa-sig-formatter";
import { fromEnv } from "@aws-sdk/credential-providers";
import { SignerPayLoad, SignerHeader } from "./signer-payload";
import { SignageType } from "./signage-type";
import { base64url } from "jose";
import {
  KMSClient,
  MessageType,
  SignCommand,
  SigningAlgorithmSpec,
} from "@aws-sdk/client-kms";
import { LogHelper } from "../../logging/log-helper";
import { Context } from "aws-lambda";
import { initOpenTelemetry } from "open-telemetry/src/otel-setup";

initOpenTelemetry();

export class JwtSignerHandler implements LambdaInterface {
  constructor(private kmsClient: KMSClient) {}

  public async handler(
    event: SignerPayLoad,
    context: Context
  ): Promise<string> {
    const logHelper = new LogHelper(context);
    logHelper.logEntry(context.functionName, event.govJourneyId);

    const parsedHeader = JSON.parse(event.header) as SignerHeader;

    if (parsedHeader.kid) {
      parsedHeader.kid = `did:web:${
        process.env.DOMAIN_NAME
      }#${this.getHashedKid(parsedHeader.kid)}`;
    }

    const header = base64url.encode(JSON.stringify(parsedHeader));
    const payload = base64url.encode(event.claimsSet);

    const response = await this.signWithKms(
      header,
      payload,
      event.kid as string
    );
    const signature = sigFormatter.derToJose(
      Buffer.from(response).toString("base64"),
      "ES256"
    );

    return `${header}.${payload}.${signature}`;
  }

  private async signWithKms(
    jwtHeader: string,
    jwtPayload: string,
    KeyId: string
  ): Promise<Uint8Array> {
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
        throw new Error(
          `An unknown error occurred while signing with KMS: ${error}`
        );
      }
    }
  }

  private hashInput = (input: Buffer): Uint8Array =>
    createHash("sha256").update(input).digest();

  private getHashedKid = (keyId: string): string => {
    const kidBytes = Buffer.from(keyId, "utf8");
    const hash = createHash("sha256").update(kidBytes).digest();
    return Buffer.from(hash).toString("hex");
  };

  private isLargeSize = (message: Buffer): boolean => message.length >= 4096;
}

const handlerClass = new JwtSignerHandler(
  new KMSClient({ region: "eu-west-2", credentials: fromEnv() })
);

export const lambdaHandler = handlerClass.handler.bind(handlerClass);
