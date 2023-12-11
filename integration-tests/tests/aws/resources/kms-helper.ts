import { createSendCommand } from "./aws-helper";
import { KMSClient, GetPublicKeyCommand } from "@aws-sdk/client-kms";
const sendCommand = createSendCommand(() => new KMSClient());

export const getPublicKey = (kid: string) =>
  sendCommand(GetPublicKeyCommand, { KeyId: kid }).then(
    (result) => result.PublicKey
  );
