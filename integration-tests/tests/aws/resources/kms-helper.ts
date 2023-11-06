import {
  KMSClient,
  SignCommand,
  SignCommandInput,
  SigningAlgorithmSpec,
  VerifyCommand,
  VerifyCommandInput,
} from "@aws-sdk/client-kms";

const client = new KMSClient({ region: process.env.AWS_REGION });

export async function sign(
  message: Uint8Array,
  keyId: string,
  signingAlgorithm: SigningAlgorithmSpec,
  signature: Uint8Array
) {
  const input = {
    KeyId: keyId,
    Message: message,
    Signature: signature,
    SigningAlgorithm: signingAlgorithm,
  } as unknown as VerifyCommandInput;

  const command = new VerifyCommand(input);

  return await client.send(command);
}
