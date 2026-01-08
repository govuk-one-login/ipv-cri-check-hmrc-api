import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { logger } from "@govuk-one-login/cri-logger";
import { retrieveSessionIdByAccessToken } from "./helpers/retrieve-session-by-access-token";
import { captureMetric, metrics } from "../../common/src/util/metrics";
import { getAttempts } from "../../common/src/database/get-attempts";
import { retrieveNinoUser } from "./helpers/retrieve-nino-user";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { dynamoDBClient } from "../../common/src/util/dynamo";
import { NinoUser } from "../../common/src/types/nino-user";
import { buildVerifiableCredential } from "./vc/vc-builder";
import { randomUUID } from "crypto";
import { PersonIdentityItem } from "../../common/src/database/types/person-identity";
import { JwtClass } from "./types/verifiable-credential";
import { toEpochSecondsFromNow } from "../../common/src/util/date-time";
import { SessionItem } from "../../common/src/database/types/session-item";
import { getHmrcContraIndicators } from "./vc/contraIndicator";

import { END, VC_ISSUED } from "../../common/src/types/audit";
import { sendAuditEvent } from "../../common/src/util/audit";
import { getAuditEvidence } from "./evidence/evidence-creator";
import { IssueCredFunctionConfig } from "./config/function-config";
import { VcCheckConfig, getVcConfig } from "./config/vc-config";
import { jwtSigner } from "./kms-signer/kms-signer";

initOpenTelemetry();

const functionConfig = new IssueCredFunctionConfig();
let vcConfig: VcCheckConfig;

class IssueCredentialHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  public async handler({ headers }: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`${context.functionName} invoked.`);
      const accessToken = (headers["Authorization"]?.match(/^Bearer [a-zA-Z0-9_-]+$/) ?? [])[0];

      if (!accessToken) throw new CriError(400, "You must provide a valid access token");

      const { attempts, personIdentity, ninoUser, session } = await this.getCheckedUserData(accessToken);

      vcConfig ??= await getVcConfig(functionConfig.credentialIssuerEnv.commonStackName);
      const contraIndicators = getHmrcContraIndicators({
        contraIndicationMapping: vcConfig.contraIndicator.errorMapping,
        contraIndicatorReasonsMapping: vcConfig.contraIndicator.reasonsMapping,
        hmrcErrors: attempts.items.filter((i) => i.attempt === "FAIL").map((item) => item.text ?? ""),
      });

      const vcClaimSet = buildVerifiableCredential(
        attempts,
        personIdentity,
        ninoUser,
        session,
        await this.generateJwtClaims(session.subject),
        contraIndicators
      );

      const signedJwt = await jwtSigner.signJwt({
        kid: vcConfig.kms.signingKeyId,
        header: JSON.stringify({ typ: "JWT", alg: "ES256", kid: vcConfig.kms.signingKeyId }),
        claimsSet: JSON.stringify(vcClaimSet),
      });

      const [vcEvidence] = vcClaimSet.vc.evidence || [];
      await sendAuditEvent(VC_ISSUED, functionConfig.audit, session, {
        restricted: {
          birthDate: personIdentity.birthDates,
          name: personIdentity.names,
          socialSecurityRecord: [
            {
              personalNumber: ninoUser.nino,
            },
          ],
        },
        extensions: {
          evidence: [getAuditEvidence(attempts, contraIndicators, vcEvidence)],
        },
      });

      captureMetric("VCIssuedMetric");
      await sendAuditEvent(END, functionConfig.audit, session);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/jwt",
        },
        body: signedJwt,
      };
    } catch (error: unknown) {
      return handleErrorResponse(error);
    }
  }
  private async getCheckedUserData(accessToken: string) {
    const sessionId = await retrieveSessionIdByAccessToken(
      functionConfig.tableNames.sessionTable,
      dynamoDBClient,
      accessToken
    );

    logger.info(`Function initialized. Retrieving session...`);
    const session: SessionItem = await getSessionBySessionId(functionConfig.tableNames.sessionTable, sessionId);
    logger.appendKeys({
      govuk_signin_journey_id: session.clientSessionId,
    });
    logger.info(`Identified government journey id: ${session.clientSessionId}. Retrieving attempts ...`);

    const attempts = await getAttempts(functionConfig.tableNames.attemptTable, dynamoDBClient, session.sessionId);
    logger.info(`Identified ${attempts.items.filter((i) => i.attempt === "FAIL").length} failed attempts.`);

    const personIdentity: PersonIdentityItem = await getRecordBySessionId(
      dynamoDBClient,
      functionConfig.tableNames.personIdentityTable,
      session.sessionId,
      "expiryDate"
    );
    logger.info("Successfully retrieved the person identity record.");

    const ninoUser: NinoUser = await retrieveNinoUser(
      functionConfig.tableNames.ninoUserTable,
      dynamoDBClient,
      session.sessionId
    );
    logger.info("Successfully retrieved the nino user record.");

    return { attempts, session, personIdentity, ninoUser };
  }

  private async generateJwtClaims(subject: string): Promise<JwtClass> {
    return {
      sub: subject,
      nbf: toEpochSecondsFromNow(),
      iss: functionConfig.credentialIssuerEnv.issuer,
      exp: toEpochSecondsFromNow(
        functionConfig.credentialIssuerEnv.maxJwtTtl,
        functionConfig.credentialIssuerEnv.jwtTtlUnit
      ),
      jti: `urn:uuid:${randomUUID().toString()}`,
    };
  }
}

const handlerClass = new IssueCredentialHandler();
export const handler = handlerClass.handler.bind(handlerClass);
