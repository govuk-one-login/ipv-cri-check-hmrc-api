import fs from "fs";
import path from "path";
import { setupIntegrationContext } from "./context-helper";

export type ApiTestContext = {
  privateApi: string;
  publicApi: string;
  audience: string;
  privateSigningKey: string;
  publicEncryptionKeyBase64: string;
  ninoUsersTable: string;
  userAttemptsTable: string;
};

export default async function globalSetup() {
  const { CLIENT_ID } = await import("../env-variables");

  const { outputs } = await setupIntegrationContext();
  const { ssmParams } = await setupIntegrationContext([
    "/check-hmrc-cri-api/test/publicEncryptionKeyBase64",
    "/check-hmrc-cri-api/test/privateSigningKey",
    `/${outputs?.CommonStackName}/clients/${CLIENT_ID}/jwtAuthentication/audience`,
  ]);

  const context: ApiTestContext = {
    privateApi: outputs?.PrivateApiGatewayId as string,
    publicApi: outputs?.PublicApiGatewayId as string,
    audience:
      ssmParams?.[
        `/${outputs?.CommonStackName}/clients/${CLIENT_ID}/jwtAuthentication/audience`
      ] ?? "",
    privateSigningKey: JSON.parse(
      ssmParams?.["/check-hmrc-cri-api/test/privateSigningKey"] ?? "{}"
    ),
    publicEncryptionKeyBase64:
      ssmParams?.["/check-hmrc-cri-api/test/publicEncryptionKeyBase64"] ?? "",
    ninoUsersTable: outputs?.NinoUsersTable as string,
    userAttemptsTable: outputs?.UserAttemptsTable as string,
  };

  fs.writeFileSync(
    path.resolve(__dirname, "integration-context.json"),
    JSON.stringify(context),
    "utf-8"
  );

  return context;
}
