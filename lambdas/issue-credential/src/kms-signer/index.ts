import { KMSClient } from "@aws-sdk/client-kms";
import { fromEnv } from "@aws-sdk/credential-providers";
import { signJwt } from "./kms-signer";
import { SignerPayLoad } from "./types/signer-payload";

const kmsClient = new KMSClient({ region: process.env.AWS_REGION, credentials: fromEnv() });

export const jwtSigner = {
  signJwt: (payload: SignerPayLoad) => signJwt(kmsClient, payload),
};
