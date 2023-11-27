import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";

const kmsClient = new KMSClient({ region: "eu-west-2" });

export const getPublicKey = async (kid: string) => {
  return await kmsClient.send(new GetPublicKeyCommand({ KeyId: kid }));
};
