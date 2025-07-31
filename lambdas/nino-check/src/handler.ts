import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";
import { writeCompletedCheck } from "./helpers/write-completed-check";
import { NinoCheckFunctionConfig } from "./helpers/function-config";
import { getHmrcConfig, saveTxn, handleResponseAndSaveAttempt } from "./helpers/nino";
import { CriError } from "../../common/src/errors/cri-error";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { dynamoDBClient } from "../../common/src/util/dynamo";
import { logger } from "../../common/src/util/logger";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { captureMetric, metrics } from "../../common/src/util/metrics";
import { getTokenFromOtg } from "./hmrc-apis/otg";
import { callPdvMatchingApi } from "./hmrc-apis/pdv";
import { safeStringifyError } from "../../common/src/util/stringify-error";
import { buildPdvInput } from "./helpers/build-pdv-input";
import { ParsedPdvMatchResponse } from "./hmrc-apis/types/pdv";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { PersonIdentityItem } from "../../common/src/database/types/person-identity";
import { getAttempts } from "../../common/src/database/get-attempts";
import { sendAuditEvent } from "../../common/src/util/audit";
import { REQUEST_SENT, RESPONSE_RECEIVED } from "../../common/src/types/audit";

initOpenTelemetry();

const MAX_PAST_ATTEMPTS = 1;

type InputBody = {
  nino: string;
};

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

      logger.info(`Function initialised. Retrieving session...`);

      const session = await getSessionBySessionId(functionConfig.tableNames.sessionTable, sessionId, true);

      logger.appendKeys({
        govuk_signin_journey_id: session.clientSessionId,
      });
      logger.info(`Identified government journey id: ${session.clientSessionId}. Retrieving HMRC config from SSM...`);

      const hmrcApiConfig = await getHmrcConfig(session.clientId, functionConfig.hmrcApi.pdvUserAgentParamName);

      logger.info(`HMRC config retrieved from SSM.`);

      const { count: pastAttemptCount } = await getAttempts(
        functionConfig.tableNames.attemptTable,
        dynamoDBClient,
        sessionId
      );
      if (pastAttemptCount > MAX_PAST_ATTEMPTS) {
        captureMetric(`AttemptsExceededMetric`);
        logger.info(`Too many attempts. Returning requestRetry: false.`);
        return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
      }

      const isFinalAttempt = pastAttemptCount === MAX_PAST_ATTEMPTS;

      logger.info(`User has ${pastAttemptCount} past attempts. Retrieving person identity...`);

      const personIdentity = await getRecordBySessionId<PersonIdentityItem>(
        dynamoDBClient,
        functionConfig.tableNames.personIdentityTable,
        sessionId,
        "expiryDate"
      );

      logger.info(
        `Retrieved session and person identity. isFinalAttempt=${isFinalAttempt}. Validating provided NINo information...`
      );

      const token = await getTokenFromOtg(hmrcApiConfig.otg);

      logger.info(`Successfully retrieved OAuth token from HMRC. Proceeding with PDV request...`);

      const auditDeviceInformation = deviceInformationHeader
        ? {
            device_information: {
              encoded: deviceInformationHeader,
            },
          }
        : undefined;

      await sendAuditEvent(REQUEST_SENT, functionConfig.audit, session, {
        restricted: {
          birthDate: personIdentity.birthDates,
          name: personIdentity.names,
          socialSecurityRecord: [
            {
              personalNumber: nino,
            },
          ],
          ...auditDeviceInformation,
        },
      });

      logger.info(`REQUEST_SENT event fired.`);

      let parsedPdvMatchResponse: ParsedPdvMatchResponse;

      try {
        parsedPdvMatchResponse = await callPdvMatchingApi(
          hmrcApiConfig.pdv,
          token,
          buildPdvInput(personIdentity, nino)
        );
      } catch (error) {
        captureMetric(`MatchingLambdaErrorMetric`);
        logger.error(`Error in ${context.functionName}: ${safeStringifyError(error)}`);
        throw new CriError(500, "Unexpected error when validating NINo");
      }

      logger.info(`Called matching API successfully. Saving txn against user session...`);

      await saveTxn(dynamoDBClient, functionConfig.tableNames.sessionTable, sessionId, parsedPdvMatchResponse.txn);

      logger.info(`Saved txn.`);

      await sendAuditEvent(RESPONSE_RECEIVED, functionConfig.audit, session, {
        restricted: auditDeviceInformation,
        extensions: { evidence: { txn: parsedPdvMatchResponse.txn } },
      });

      logger.info(`RESPONSE_RECEIVED event fired.`);

      const ninoMatch = await handleResponseAndSaveAttempt(
        dynamoDBClient,
        functionConfig.tableNames.attemptTable,
        session,
        parsedPdvMatchResponse
      );

      logger.info(`Completed NINo verification - ninoMatch=${ninoMatch}.`);

      if (!ninoMatch && !isFinalAttempt) {
        captureMetric(`RetryAttemptsSentMetric`);
        logger.info(`Failed to verify. This was not the last attempt - requesting the user retries.`);
        return { statusCode: 200, body: JSON.stringify({ requestRetry: true }) };
      }

      logger.info(`No need for further retries. Issuing authorization code...`);

      await writeCompletedCheck(dynamoDBClient, functionConfig.tableNames, session, nino);

      logger.info(`Authorization code saved. Returning...`);

      return { statusCode: 200, body: JSON.stringify({ requestRetry: false }) };
    } catch (error) {
      return handleErrorResponse(error, logger);
    }
  }
}

const handlerClass = new NinoCheckHandler();
export const handler = handlerClass.handler.bind(handlerClass);
