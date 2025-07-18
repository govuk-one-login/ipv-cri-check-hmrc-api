import { createSendCommand } from "./aws-helper";
import { KMSClient, GetPublicKeyCommand } from "@aws-sdk/client-kms";
const kmsClient = new KMSClient();
const sendCommand = createSendCommand(() => kmsClient);

export { kmsClient };
export const getPublicKey = (kid: string) =>
  sendCommand(GetPublicKeyCommand, { KeyId: kid }).then((result) => result.PublicKey);
