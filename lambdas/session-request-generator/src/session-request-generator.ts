import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import * as jose from "jose";
import {
  CompactEncrypt,
  importJWK,
  JWK,
  JWTHeaderParameters,
  JWTPayload,
  SignJWT,
} from "jose";
import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyResult } from "aws-lambda";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";

//TODO: register new clientId
//TODO: create callback lambda

const logger = new Logger();
const kmsClient = new KMSClient();

const cfClient = new CloudFormationClient();

const apiStackName = process.env.apiStackName;
const frontendStackName = process.env.frontendStackName;

let apiStackOutput: Partial<{
  PrivateApiGatewayId: string;
}>;

let frontendStackOutput: Partial<{
  FrontUrl: string;
}>;

let coreInfraStackOutput: Partial<{
  CriDecryptionKey1Id: string;
  CriVcSigningKey1Id: string;
}>;

let publicEncryptionKeyBase64: string;
let sessionEndpointUrl: string;

export class SessionRequestGenerator implements LambdaInterface {
  public async handler(
    event: {
      queryStringParameters: {
        clientId?: string;
        audience?: string;
      };
      body?: any;
    },
    _context: unknown
  ): Promise<APIGatewayProxyResult> {
    try {
      logger.info("Entry SessionRequestGenerator");

      if (
        !event.queryStringParameters.clientId ||
        !event.queryStringParameters.audience
      ) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Missing required query parameters: clientId, audience",
          }),
        };
      }

      if (!event.body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Missing required body",
          }),
        };
      }

      logger.info("Calling init()");
      await init();

      const privateSigningKey = JSON.parse(process.env.privateSigningKey || "");

      if (!privateSigningKey) {
        throw new Error("No privateSigningKey provided");
      }

      logger.info("Creating payload for session endpoint");

      const ipvCoreAuthorizationUrl = await createPayload(
        publicEncryptionKeyBase64,
        privateSigningKey,
        event.queryStringParameters.clientId,
        event.queryStringParameters.audience,
        event.body
      );

      logger.info("Calling session endpoint");
      const sessionRequest = await callSessionEndpoint(
        JSON.stringify(ipvCoreAuthorizationUrl)
      );

      logger.info("Generated sessionId: " + sessionRequest.session_id);

      logger.info(
        "Redirecting user to CRI frontend https://review-hc.dev.account.gov.uk/check"
      );
      return {
        statusCode: 302,
        headers: {
          Location: "https://review-hc.dev.account.gov.uk/check",
          "session-id": sessionRequest.session_id,
        },
        body: "",
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Error occurred in SessionRequestGenerator: " + message);
      return {
        statusCode: 500,
        body: "An error occured: " + message,
      };
    }
  }
}

async function callSessionEndpoint(ipvCoreAuthorizationUrl: string) {
  const response = await fetch(sessionEndpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: ipvCoreAuthorizationUrl,
  });
  if (!response.ok) {
    throw new Error(
      `Error calling session endpoint status: ${response.status}`
    );
  }
  return await response.json();
}

async function init() {
  logger.info("Entry init()");

  if (!coreInfraStackOutput) {
    logger.info("Fetching stack output for core-infrastructure");

    const coreInfraOutput = (
      await cfClient.send(
        new DescribeStacksCommand({
          StackName: "core-infrastructure",
        })
      )
    )?.Stacks?.at(0)?.Outputs;

    logger.info("Received core-infrastructure output");

    const criDecryptionKey1Id = coreInfraOutput?.find(
      (o) => o.OutputKey == "CriDecryptionKey1Id"
    )?.OutputValue;

    const criVcSigningKey1Id = coreInfraOutput?.find(
      (o) => o.OutputKey == "CriVcSigningKey1Id"
    )?.OutputValue;

    coreInfraStackOutput = {
      CriDecryptionKey1Id: criDecryptionKey1Id,
      CriVcSigningKey1Id: criVcSigningKey1Id,
    };

    logger.info(
      "Fetching key from CriDecryptionKey1Id " +
        coreInfraStackOutput.CriDecryptionKey1Id
    );
    publicEncryptionKeyBase64 = base64Encode(
      JSON.stringify(
        await getJwkFromPem(
          coreInfraStackOutput.CriDecryptionKey1Id || "",
          "RS256",
          "enc"
        )
      )
    );
  }
  if (!apiStackOutput) {
    logger.info("Fetching stack output for " + apiStackName);

    const apiStack = (
      await cfClient.send(
        new DescribeStacksCommand({
          StackName: "core-infrastructure",
        })
      )
    )?.Stacks?.at(0)?.Outputs;

    const privateApiGatewayId = apiStack?.find(
      (o) => o.OutputKey == "PrivateApiGatewayId"
    )?.OutputValue;

    apiStackOutput = {
      PrivateApiGatewayId: privateApiGatewayId,
    };

    sessionEndpointUrl = `https://rovn42f9o4.execute-api.eu-west-2.amazonaws.com/${process.env.environment}/session-ts`;
    logger.info("Loaded session endpoint to be: " + sessionEndpointUrl);
  }
  if (!frontendStackOutput) {
    logger.info("Fetching stack output for " + frontendStackName);

    const frontStack = (
      await cfClient.send(
        new DescribeStacksCommand({
          StackName: frontendStackName,
        })
      )
    )?.Stacks?.at(0)?.Outputs;

    const frontUrl = frontStack?.find((o) => o.OutputKey == "FrontUrl")
      ?.OutputValue;

    frontendStackOutput = {
      FrontUrl: frontUrl,
    };

    logger.info("Loaded frontend endpoint to be: " + frontUrl);
  }
  logger.info("Exit init()");
}

const msToSeconds = (ms: number) => Math.round(ms / 1000);

const buildJarAuthorizationRequest = async (params: any) => {
  const jwtPayload: JWTPayload = {
    iss: params.issuer,
    iat: msToSeconds(Date.now()),
    nbf: msToSeconds(Date.now()),
    exp: msToSeconds(Date.now() + 5 * 60 * 1000),
    client_id: params.clientId,
    redirect_uri: params.redirectUrl,
    response_type: "code",
    state: uuidv4(),
    govuk_signin_journey_id: uuidv4(),
    sub: uuidv4(),
    aud: params.audience,
    ...params.claimSet,
  };

  const signedJwt = await signJwt(jwtPayload, params);

  const encryptionKeyJwk = await importJwkFromBase64(
    params.publicEncryptionKeyBase64
  );
  const encryptedSignedJwt = await new CompactEncrypt(
    new TextEncoder().encode(signedJwt)
  )
    .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM" })
    .encrypt(encryptionKeyJwk);
  return {
    client_id: params.clientId,
    request: encryptedSignedJwt,
  };
};

const importJwkFromBase64 = async (base64: string) => {
  const decoded = Buffer.from(base64, "base64").toString();
  const keyObject = JSON.parse(decoded);
  return await importJWK(keyObject, "RSA256");
};

export type PrivateKeyType =
  | { privateSigningKey: string | JWK }
  | { privateSigningKeyId: string };

export type BaseParams = {
  issuer?: string;
  customClaims?: JWTPayload;
} & PrivateKeyType;

const signJwt = async (
  jwtPayload: JWTPayload,
  params: BaseParams,
  jwtHeader: JWTHeaderParameters = { alg: "ES256", typ: "JWT" }
) => {
  if ("privateSigningKey" in params && params.privateSigningKey) {
    return await new SignJWT(jwtPayload)
      .setProtectedHeader(jwtHeader)
      .sign(await importJWK(params.privateSigningKey as JWK, "ES256"));
  } else {
    throw new Error("No signing key provided!");
  }
};

const getPublicKeyPem = async (keyId: string): Promise<string> => {
  const data = await kmsClient.send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (data.PublicKey) {
    const base64PublicKey = Buffer.from(data.PublicKey).toString("base64");
    const header = "-----BEGIN PUBLIC KEY-----";
    const footer = "-----END PUBLIC KEY-----";
    const value = base64PublicKey.match(/.{1,64}/g)?.join("\n");
    return `${header}\n${value}\n${footer}`;
  } else {
    throw new Error("Public key not found");
  }
};

const pemToJwk = async (pem: string, alg: string) => {
  const key = await jose.importSPKI(pem, alg);
  return await jose.exportJWK(key);
};

const getJwkFromPem = async (keyId: string, alg: string, use: string) => {
  const pem = await getPublicKeyPem(keyId);
  const jwk = await pemToJwk(pem, alg);
  jwk.use = use;
  jwk.alg = alg;
  return jwk;
};

const base64Encode = (input: string): string => {
  return Buffer.from(input).toString("base64");
};

const createPayload = async (
  publicEncryptionKeyBase64: string,
  privateSigningKey: string,
  clientId: string,
  audience: string,
  body: string
) => {
  const claimSet = body;
  const payload = {
    clientId,
    audience,
    authorizationEndpoint: `${audience}/oauth2/authorize`,
    redirectUrl: `${clientId}/callback`,
    publicEncryptionKeyBase64,
    privateSigningKey,
    issuer: clientId,
    claimSet,
  };
  return await buildJarAuthorizationRequest(payload);
};

const handlerClass = new SessionRequestGenerator();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
