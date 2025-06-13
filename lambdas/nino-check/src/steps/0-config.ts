import { NinoCheckConfig } from "../types/input";

const requiredEnvVars = {
  otgApi: "HMRC_OTG_API_URL",
  pdvApi: "HMRC_PDV_API_URL",
  pdvAgent: "HMRC_PDV_USER_AGENT",
  sessionTableSuffix: "SESSION_TABLE_SUFFIX",
  personIdentityTableSuffix: "PERSON_IDENTITY_TABLE_SUFFIX",
  attemptTableSuffix: "ATTEMPT_TABLE_SUFFIX",
  ninoUserTableSuffix: "NINO_USER_TABLE_SUFFIX",
};

export function getConfig(clientId: string): NinoCheckConfig {
  Object.values(requiredEnvVars).forEach((name) => {
    if (!process.env[name]) {
      throw new Error(`Missing required environment variable at init: ${name}`);
    }
  });

  return {
    hmrcApiConfig: {
      otg: { apiUrl: process.env[requiredEnvVars.otgApi] as string },
      pdv: {
        apiUrl: process.env[requiredEnvVars.pdvApi] as string,
        userAgent: process.env[requiredEnvVars.pdvAgent] as string,
      },
    },
    tableNames: {
      sessionTable: `${clientId}-${
        process.env[requiredEnvVars.sessionTableSuffix]
      }`,
      personIdentityTable: `${clientId}-${
        process.env[requiredEnvVars.personIdentityTableSuffix]
      }`,
      attemptTable: `${clientId}-${
        process.env[requiredEnvVars.attemptTableSuffix]
      }`,
      ninoUserTable: `${clientId}-${
        process.env[requiredEnvVars.ninoUserTableSuffix]
      }`,
    },
  };
}
