import { KMSClient } from "@aws-sdk/client-kms";
import { fromEnv } from "@aws-sdk/credential-providers";
import { JwtSigner } from "./jwt-signer";
import { SignerPayLoad } from "./signer-payload";

const kmsClient = new KMSClient({ region: "eu-west-2", credentials: fromEnv() });
const jwtSigner = new JwtSigner(kmsClient);

export const signJwt = (payload: SignerPayLoad): Promise<string> => jwtSigner.signJwt(payload);

export * from "./signer-payload";
export * from "./signage-type";
