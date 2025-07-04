import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { writeCompletedCheck } from "./helpers/write-completed-check";
import { NinoCheckFunctionConfig } from "./helpers/function-config";
import { getHmrcConfig, saveTxn, handleResponseAndSaveAttempt } from "./helpers/nino";
import { InputBody } from "./types/input";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "../../common/src/util/logger";
import { retrieveSession } from "./helpers/retrieve-session";
import { retrieveAttempts } from "./helpers/retrieve-attempts";
import { retrievePersonIdentity } from "./helpers/retrieve-person-identity";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { captureMetric, metrics } from "../../common/src/util/metrics";
import { getTokenFromOtg } from "./hmrc-apis/otg";
import { sendRequestSentEvent, sendResponseReceivedEvent } from "./helpers/audit";
import { matchUserDetailsWithPdv } from "./hmrc-apis/pdv";
import { PdvFunctionOutput } from "./hmrc-apis/types/pdv";
import { safeStringifyError } from "../../common/src/util/stringify-error";
import { buildPdvInput } from "./helpers/build-pdv-input";

initOpenTelemetry();

const dynamoClient = new DynamoDBClient();

const MAX_PAST_ATTEMPTS = 1;

class NinoCheckHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  public async handler({ body, headers }: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`${context.functionName} invoked.`);

      const sessionId = headers["session-id"] as string;
      const deviceInformationHeader = headers["txma-audit-encoded"];
      const { nino } = JSON.parse(body as string) as InputBody;

      const functionConfig = new NinoCheckFunctionConfig();

      logger.info(`Getting person & session data...`);

      const session = await retrieveSession(functionConfig.tableNames.sessionTable, dynamoClient, sessionId);

      logger.appendKeys({
        govuk_signin_journey_id: session.clientSessionId,
      });
      logger.info(`Identified government journey id: ${session.clientSessionId}`);

      const hmrcApiConfig = await getHmrcConfig(session.clientId, functionConfig.hmrcApi.pdvUserAgentParamName);

      const pastAttemptCount = await retrieveAttempts(functionConfig.tableNames.attemptTable, dynamoClient, sessionId);
      if (pastAttemptCount > MAX_PAST_ATTEMPTS) {
        captureMetric(`AttemptsExceededMetric`);
        logger.info(`Too many attempts. Returning requestRetry: false.`);
        return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
      }

      const isFinalAttempt = pastAttemptCount === MAX_PAST_ATTEMPTS;

      const personIdentity = await retrievePersonIdentity(
        functionConfig.tableNames.personIdentityTable,
        dynamoClient,
        sessionId
      );

      logger.info(
        `Retrieved session and person identity. isFinalAttempt=${isFinalAttempt}. Validating provided NINo information...`
      );

      const token = await getTokenFromOtg(hmrcApiConfig.otg);

      await sendRequestSentEvent(functionConfig.audit, session, personIdentity, nino, deviceInformationHeader);

      logger.info(`Successfully retrieved OAuth token from HMRC. Proceeding with PDV request...`);

      let pdvRes: PdvFunctionOutput;

      try {
        pdvRes = await matchUserDetailsWithPdv(hmrcApiConfig.pdv, token, buildPdvInput(personIdentity, nino));
      } catch (error) {
        captureMetric(`MatchingLambdaErrorMetric`);

        logger.error(`Error in ${context.functionName}: ${safeStringifyError(error)}`);

        throw new CriError(500, "Unexpected error when validating NINo");
      }

      await saveTxn(dynamoClient, functionConfig.tableNames.sessionTable, sessionId, pdvRes.txn);

      await sendResponseReceivedEvent(functionConfig.audit, session, pdvRes.txn, deviceInformationHeader);

      const ninoMatch = await handleResponseAndSaveAttempt(
        dynamoClient,
        functionConfig.tableNames.attemptTable,
        session,
        pdvRes
      );

      logger.info(`Completed NINo verification - ninoMatch=${ninoMatch}.`);

      if (!ninoMatch && !isFinalAttempt) {
        captureMetric(`RetryAttemptsSentMetric`);
        logger.info(`Failed to verify. This was not the last attempt - requesting the user retries.`);
        return { statusCode: 200, body: JSON.stringify({ requestRetry: true }) };
      }

      logger.info(`No need for further retries. Issuing authorization code...`);

      await writeCompletedCheck(dynamoClient, functionConfig.tableNames, sessionId, nino);

      return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
    } catch (error) {
      return handleErrorResponse(error, logger);
    }
  }
}

const handlerClass = new NinoCheckHandler();
export const handler = handlerClass.handler.bind(handlerClass);
