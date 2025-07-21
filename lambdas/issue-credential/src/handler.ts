import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { logger } from "../../common/src/util/logger";
import { retrieveSessionIdByAccessToken } from "./helpers/retrieve-session-by-access-token";
import { metrics } from "../../common/src/util/metrics";
import { getAttempts } from "../../common/src/database/get-attempts";
import { retrieveNinoUser } from "./helpers/retrieve-nino-user";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { dynamoDBClient } from "../../common/src/util/dynamo";
import { NinoUser } from "../../common/src/types/nino-user";
import { NinoIssueSessionItem } from "../../common/src/types/nino-issue-session-item";
import { buildVerifiableCredential } from "./vc/vc-builder";
import { randomUUID } from "crypto";
import { PersonIdentityItem } from "../../common/src/database/types/person-identity";
import { getParametersValues } from "../../common/src/util/get-parameters";
import { JwtClass } from "./types/verifiable-credential";
import { TimeUnits, toEpochSecondsFromNow } from "../../common/src/util/date-time";
import { IssueCredFunctionConfig } from "./config/function-config";
import { CiMappings } from "./vc/contraIndicator/types/ci-mappings";
import { getHmrcContraIndicators } from "./vc/contraIndicator";
import { AttemptItem } from "../../common/src/types/attempt";

initOpenTelemetry();

const functionConfig = new IssueCredFunctionConfig();

class IssueCredentialHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  public async handler({ headers }: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`${context.functionName} invoked.`);

      const accessToken = (headers["Authorization"]?.match(/^Bearer [a-zA-Z0-9_-]+$/) ?? [])[0];

      if (!accessToken) throw new CriError(400, "You must provide a valid access token");

      const { failedAttempts, personIdentity, ninoUser, session } = await this.getCheckedUserData(accessToken);

      const ssmParams = await getParametersValues([
        `/${functionConfig.credentialIssuerEnv.commonStackName}/verifiableCredentialKmsSigningKeyId`,
        "/check-hmrc-cri-api/contraindicationMappings",
        "/check-hmrc-cri-api/contraIndicatorReasonsMapping",
      ]);
      logger.info("Successfully retrieved the ssm params.");

      const ciMapping: CiMappings = this.getCiMappings(ssmParams, failedAttempts.items);

      logger.info("Building verifiable Credential");
      const vcClaimSet = buildVerifiableCredential(
        failedAttempts,
        personIdentity,
        ninoUser,
        session,
        await this.generateJwtClaims(session.subject),
        () => getHmrcContraIndicators(ciMapping)
      );
      logger.info("Verifiable Credential Structure generated successfully.");

      return {
        statusCode: 200,
        body: JSON.stringify(vcClaimSet),
      };
    } catch (error) {
      return handleErrorResponse(error, logger);
    }
  }
  private getCiMappings(ssmParams: Record<string, string>, failedAttempts: AttemptItem[]): CiMappings {
    logger.info("Generating contraIndicator mapping inputs.");
    return {
      contraIndicationMapping: ssmParams["/check-hmrc-cri-api/contraindicationMappings"].split("||"),
      contraIndicatorReasonsMapping: JSON.parse(ssmParams["/check-hmrc-cri-api/contraIndicatorReasonsMapping"]),
      hmrcErrors: failedAttempts.map((item) => item.text),
    } as CiMappings;
  }

  private async getCheckedUserData(accessToken: string) {
    const sessionId = await retrieveSessionIdByAccessToken(
      functionConfig.tableNames.sessionTable,
      dynamoDBClient,
      accessToken
    );
    logger.info("Successfully retrieved the session id.");

    const session: NinoIssueSessionItem = await getSessionBySessionId(
      functionConfig.tableNames.sessionTable,
      sessionId
    );

    logger.appendKeys({
      govuk_signin_journey_id: session.clientSessionId,
    });
    logger.info("Successfully retrieved the session record.");

    const failedAttempts = await getAttempts(
      functionConfig.tableNames.attemptTable,
      dynamoDBClient,
      session.sessionId,
      "FAIL"
    );
    logger.info(`Identified ${failedAttempts.count} failed attempts.`);

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

    return { failedAttempts, session, personIdentity, ninoUser };
  }

  private async generateJwtClaims(subject: string): Promise<JwtClass> {
    return {
      iss: functionConfig.audit.issuer,
      jti: `urn:uuid:${randomUUID().toString()}`,
      nbf: toEpochSecondsFromNow(),
      exp: toEpochSecondsFromNow(
        functionConfig.credentialIssuerEnv.maxJwtTtl,
        functionConfig.credentialIssuerEnv.jwtTtlUnit as TimeUnits
      ),
      sub: subject,
    };
  }
}

const handlerClass = new IssueCredentialHandler();
export const handler = handlerClass.handler.bind(handlerClass);
