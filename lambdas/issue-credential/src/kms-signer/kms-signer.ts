import { createHash } from "crypto";
import sigFormatter from "ecdsa-sig-formatter";
import { SignerPayLoad, SignerHeader } from "./types/signer-payload";
import { SignageType } from "./types/signage-type";
import { base64url } from "jose";
import { KMSClient, MessageType, SignCommand, SigningAlgorithmSpec } from "@aws-sdk/client-kms";

const hashInput = (input: Buffer): Uint8Array => createHash("sha256").update(input).digest();

const getHashedKid = (keyId: string): string => {
  const kidBytes = Buffer.from(keyId, "utf8");
  const hash = createHash("sha256").update(kidBytes).digest();
  return Buffer.from(hash).toString("hex");
};

const isLargeSize = (message: Buffer): boolean => message.length >= 4096;

const signWithKms = async (
  kmsClient: KMSClient,
  jwtHeader: string,
  jwtPayload: string,
  KeyId: string
): Promise<Uint8Array> => {
  const payload = Buffer.from(`${jwtHeader}.${jwtPayload}`);
  const signage: SignageType = isLargeSize(payload)
    ? { message: hashInput(payload), type: MessageType.DIGEST }
    : { message: payload, type: MessageType.RAW };

  try {
    const signingResponse = await kmsClient.send(
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof SyntaxError) {
      throw new Error(`KMS response is not in JSON format. ${message}`);
    }
    throw new Error(`KMS signing error: ${message}`);
  }
};

export const signJwt = async (kmsClient: KMSClient, payload: SignerPayLoad): Promise<string> => {
  const parsedHeader = JSON.parse(payload.header) as SignerHeader;

  if (parsedHeader.kid) {
    parsedHeader.kid = `did:web:${process.env.DOMAIN_NAME}#${getHashedKid(parsedHeader.kid)}`;
  }

  const header = base64url.encode(JSON.stringify(parsedHeader));
  const claimsSet = base64url.encode(payload.claimsSet);

  const response = await signWithKms(kmsClient, header, claimsSet, payload.kid as string);
  const signature = sigFormatter.derToJose(Buffer.from(response).toString("base64"), "ES256");

  return `${header}.${claimsSet}.${signature}`;
};
