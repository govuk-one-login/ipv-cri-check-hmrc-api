import { Logger } from "@aws-lambda-powertools/logger";
import { stackOutputs } from "../../resources/cloudformation-helper";
import { JweDecrypter } from "../crypto/jwe-decrypter";
import { JwtVerifierFactory, ClaimNames } from "../crypto/jwt-verifier";
import { AUDIENCE, CLIENT_ID, CLIENT_URL, CORE_INFRASTRUCTURE } from "../env-variables";
import { getSSMParameter } from "../../resources/ssm-param-helper";
import { base64url, JWTVerifyResult } from "jose";
import { kmsClient } from "../../resources/kms-helper";
import { createSession, getJarAuthorization } from "../endpoints";
import { clearItemsFromTables } from "../../resources/dynamodb-helper";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

interface StartEndpointResponse {
  client_id: string;
  request: string;
}

describe.each([
  {
    keyRotation: "true",
    legacyFallback: "true",
    description: "when key rotation is enabled and legacy fallback feature is enabled",
  },
  {
    keyRotation: "true",
    legacyFallback: "false",
    description: "when key rotation is enabled and legacy fallback feature is disabled",
  },
])(
  "Given there is a ./well-known/jwks with a key to encrypt claims",
  ({ keyRotation, legacyFallback, description }) => {
    let response: Response;
    let jarRequest: StartEndpointResponse;
    let decryptedJwt: Buffer;
    let verificationResult: JWTVerifyResult | null;
    let originalRotationFlag: string | undefined;
    let originalFallbackFlag: string | undefined;

    const jwtVerifierFactory = new JwtVerifierFactory(new Logger());
    let jweDecrypter: JweDecrypter;
    let authenticationAlg: string | undefined;

    beforeAll(async () => {
      originalRotationFlag = process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION;
      originalFallbackFlag = process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION_LEGACY_KEY_FALLBACK;

      process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION = keyRotation;
      process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION_LEGACY_KEY_FALLBACK = legacyFallback;

      const { CriDecryptionKey1Id: decryptionKeyId } = await stackOutputs(CORE_INFRASTRUCTURE);
      authenticationAlg = await getSSMParameter(
        `/${process.env.COMMON_STACK_NAME}/clients/${CLIENT_ID}/jwtAuthentication/authenticationAlg`
      );
      jweDecrypter = new JweDecrypter(kmsClient, () => decryptionKeyId);
    });

    afterAll(() => {
      process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION = originalRotationFlag;
      process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION_LEGACY_KEY_FALLBACK = originalFallbackFlag;
    });

    describe(description, () => {
      it("then the headless core stub makes a request to the Start Endpoint", async () => {
        response = await getJarAuthorization();
        jarRequest = await response.json();
      });

      it("and the request is successful", () => {
        expect(response.status).toBe(200);
        expect(jarRequest.client_id).toBe(CLIENT_ID);
      });

      it(`any KMS aliases succeeds in decryption ${description}`, async () => {
        const decryptKeyWithKmsSpy = vi.spyOn(jweDecrypter, "decryptKeyWithKms");

        await jweDecrypter.decryptJwe(jarRequest.request);

        expect(decryptKeyWithKmsSpy).toHaveBeenCalledTimes(1);

        expect(decryptKeyWithKmsSpy).toHaveBeenCalledWith(expect.any(Uint8Array), expect.stringMatching(/alias\//));

        decryptKeyWithKmsSpy.mockRestore();
      });

      it("then the response can be decrypted", async () => {
        expect(jarRequest.request).toBeDefined();
        decryptedJwt = await jweDecrypter.decryptJwe(jarRequest.request);
        expect(decryptedJwt).toBeDefined();
      });

      it("and response is verified successfully", async () => {
        const jwtVerifier = jwtVerifierFactory.create(authenticationAlg as string);
        verificationResult = await jwtVerifier.verify(
          decryptedJwt,
          new Set([ClaimNames.EXPIRATION_TIME, ClaimNames.SUBJECT, ClaimNames.NOT_BEFORE, ClaimNames.STATE]),
          new Map([
            [ClaimNames.AUDIENCE, AUDIENCE],
            [ClaimNames.ISSUER, CLIENT_URL],
          ])
        );

        expect(verificationResult?.protectedHeader.alg).toBe("ES256");
        expect(verificationResult?.protectedHeader.typ).toBe("JWT");
        expect(verificationResult?.payload.iss).toBe(CLIENT_URL);
        expect(verificationResult?.payload.aud).toBe(AUDIENCE);

        expect(verificationResult?.payload.shared_claims).toEqual({
          name: [
            {
              nameParts: [
                {
                  type: "GivenName",
                  value: "KENNETH",
                },
                {
                  type: "FamilyName",
                  value: "DECERQUEIRA",
                },
              ],
            },
          ],
          birthDate: [{ value: "1965-07-08" }],
          address: [
            {
              addressLocality: "BATH",
              buildingNumber: "8",
              postalCode: "BA2 5AA",
              streetName: "HADLEY ROAD",
              validFrom: "2021-01-01",
            },
          ],
        });
        const decodedState = JSON.parse(
          new TextDecoder().decode(base64url.decode(verificationResult?.payload.state as string))
        );
        expect(decodedState).toEqual({
          aud: AUDIENCE,
          redirect_uri: expect.stringContaining("callback"),
        });
      });

      describe("Check HMRC CRI", () => {
        let sessionId: string;
        let sessionTableName: string;
        let sessionResponse: Response;
        let jsonSession: { session_id: string };

        beforeAll(async () => {
          sessionTableName = `${process.env.SESSION_TABLE}`;
          sessionResponse = await createSession(`${process.env.PRIVATE_API}`, jarRequest);
          jsonSession = await sessionResponse.json();
          sessionId = jsonSession.session_id;
        });

        afterEach(async () => {
          await clearItemsFromTables(
            {
              tableName: `${process.env.PERSON_IDENTITY_TABLE}`,
              items: { sessionId: sessionId },
            },
            {
              tableName: sessionTableName,
              items: { sessionId: sessionId },
            }
          );
        });

        it("session endpoint is called", () => {
          expect(sessionResponse).toBeDefined();
          expect(jsonSession).toBeDefined();
        });

        it("and successfully receives a 201 created with a valid session id", () => {
          expect(sessionResponse.status).toEqual(201);
          expect(sessionId).toBeDefined();
        });
      });
    });
  }
);

describe("Given there is a ./well-known/jwks with a key to encrypt claims - when key rotation is disabled", () => {
  let response: Response;
  let jarRequest: StartEndpointResponse;
  let originalRotationFlag: string | undefined;
  let originalFallbackFlag: string | undefined;

  let jweDecrypter: JweDecrypter;

  beforeAll(async () => {
    originalRotationFlag = process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION;
    originalFallbackFlag = process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION_LEGACY_KEY_FALLBACK;

    process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION = "false";
    process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION_LEGACY_KEY_FALLBACK = "false";

    const { CriDecryptionKey1Id: decryptionKeyId } = await stackOutputs(CORE_INFRASTRUCTURE);

    jweDecrypter = new JweDecrypter(kmsClient, () => decryptionKeyId);
  });

  afterAll(() => {
    process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION = originalRotationFlag;
    process.env.ENV_VAR_FEATURE_FLAG_KEY_ROTATION_LEGACY_KEY_FALLBACK = originalFallbackFlag;
  });

  it("when the headless core stub makes a request to the Start Endpoint", async () => {
    response = await getJarAuthorization();
    jarRequest = await response.json();
  });

  it("and the request is successful", () => {
    expect(response.status).toBe(200);
    expect(jarRequest.client_id).toBe(CLIENT_ID);
  });

  it("uses legacy KMS ID and throws error when decrypting JWE", async () => {
    const decryptKeyWithKmsSpy = vi.spyOn(jweDecrypter, "decryptKeyWithKms");

    await expect(jweDecrypter.decryptJwe(jarRequest.request)).rejects.toThrow(/Failed to decrypt with legacy key/);

    expect(decryptKeyWithKmsSpy).toHaveBeenCalledTimes(1);
    expect(decryptKeyWithKmsSpy).toHaveBeenCalledWith(expect.any(Uint8Array), expect.not.stringMatching(/alias\//));

    decryptKeyWithKmsSpy.mockRestore();
  });
});
