import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { addAuthCodeToSession } from "./helpers/add-auth-code-to-session";
import { NinoCheckFunctionConfig } from "./helpers/function-config";
import { getHmrcConfig, saveAttempt, saveTxn, handlePdvResponse } from "./helpers/validate-nino";
import { InputBody } from "./types/input";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { logger } from "../../common/src/util/logger";
import { retrieveSession } from "./helpers/retrieve-session";
import { retrieveAttempts } from "./helpers/retrieve-attempts";
import { retrievePersonIdentity } from "./helpers/retrieve-person-identity";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { captureMetric } from "../../common/src/util/metrics";
import { getTokenFromOtg } from "./hmrc-apis/otg";
import { sendRequestSentEvent, sendResponseReceivedEvent } from "./helpers/audit";
import { buildPdvInput, matchUserDetailsWithPdv } from "./hmrc-apis/pdv";
import { PdvFunctionOutput } from "./hmrc-apis/types/pdv";
import { safeStringifyError } from "../../common/src/util/stringify-error";

initOpenTelemetry();

const dynamoClient = new DynamoDBClient();

const MAX_PAST_ATTEMPTS = 1;

class NinoCheckHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  public async handler({ body, headers }: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info(`${context.functionName} invoked.`);

      const sessionId = headers["session-id"] as string;
      const deviceInformationHeader = headers["txma-audit-encoded"];
      const { nino } = JSON.parse(body as string) as InputBody;

      const functionConfig = new NinoCheckFunctionConfig({ deviceInformationHeader });
      const { tableNames } = functionConfig;

      logger.info(`Getting person & session data...`);

      const session = await retrieveSession(tableNames.sessionTable, dynamoClient, sessionId);

      logger.appendKeys({
        govuk_signin_journey_id: session.clientSessionId,
      });
      logger.info(`Identified government journey id: ${session.clientSessionId}`);

      const hmrcApiConfig = await getHmrcConfig(session.clientId, functionConfig.hmrcApi.pdvUserAgentParamName);

      const pastAttemptCount = await retrieveAttempts(tableNames.attemptTable, dynamoClient, sessionId);
      if (pastAttemptCount > MAX_PAST_ATTEMPTS) {
        captureMetric(`AttemptsExceededMetric`);
        logger.info(`Too many attempts. Returning requestRetry: false.`);
        return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
      }

      const isFinalAttempt = pastAttemptCount === MAX_PAST_ATTEMPTS;

      const personIdentity = await retrievePersonIdentity(tableNames.personIdentityTable, dynamoClient, sessionId);

      logger.info(
        `Retrieved session and person identity. isFinalAttempt=${isFinalAttempt}. Validating provided NINo information...`
      );

      const token = await getTokenFromOtg(hmrcApiConfig.otg);

      await sendRequestSentEvent(functionConfig.audit, session, personIdentity, nino);

      logger.info(`Successfully retrieved OAuth token from HMRC. Proceeding with PDV request...`);

      let pdvRes: PdvFunctionOutput;

      try {
        pdvRes = await matchUserDetailsWithPdv(hmrcApiConfig.pdv, token, buildPdvInput(personIdentity, nino));
      } catch (error) {
        captureMetric(`MatchingLambdaErrorMetric`);

        logger.error(`Error in ${context.functionName}: ${safeStringifyError(error)}`);

        throw new CriError(500, "Unexpected error when validating NINo");
      }

      await saveTxn(dynamoClient, tableNames.sessionTable, sessionId, pdvRes.txn);

      await sendResponseReceivedEvent(functionConfig.audit, session, pdvRes.txn);

      const ninoMatch = await handlePdvResponse(pdvRes);

      if (ninoMatch) {
        await saveAttempt(dynamoClient, tableNames.attemptTable, session, pdvRes);
      }

      logger.info(`Completed NINo verification - ninoMatch=${ninoMatch}.`);

      if (!ninoMatch && !isFinalAttempt) {
        logger.info(`Failed to verify. This was not the last attempt - requesting the user retries.`);
        return { statusCode: 200, body: JSON.stringify({ requestRetry: true }) };
      }

      logger.info(`No need for further retries. Issuing authorization code...`);

      await addAuthCodeToSession(dynamoClient, tableNames, sessionId, nino);

      return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
    } catch (error) {
      return handleErrorResponse(error, logger);
    }
  }
}

const handlerClass = new NinoCheckHandler();
export const handler = handlerClass.handler.bind(handlerClass);
