import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { ISO8601DateString } from "../../../common/src/types/brands";
import { PdvApiErrorBody, PdvFunctionOutput } from "../hmrc-apis/types/pdv";
import { marshall } from "@aws-sdk/util-dynamodb";
import { CriError } from "../../../common/src/errors/cri-error";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { AttemptItem } from "../types/attempt";
import { logger } from "../../../common/src/util/logger";
import { NinoSessionItem } from "../types/nino-session-item";
import { captureMetric } from "../../../common/src/util/metrics";
import { HmrcApiConfig } from "./function-config";

export type AuditUser = {
  govuk_signin_journey_id: string;
  ip_address: string;
  session_id: string;
  user_id: string;
  persistent_session_id?: string;
};

const cacheTtlInSeconds = Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;

export async function getHmrcConfig(clientId: string, pdvUserAgentParamName: string): Promise<HmrcApiConfig> {
  const otgParamName = `/check-hmrc-cri-api/OtgUrl/${clientId}`;
  const pdvParamName = `/check-hmrc-cri-api/NinoCheckUrl/${clientId}`;

  const { _errors: errors, ...ssmParams } = await getParametersByName<string>(
    {
      [otgParamName]: {},
      [pdvParamName]: {},
      [pdvUserAgentParamName]: {},
    },
    { maxAge: cacheTtlInSeconds, throwOnError: false }
  );

  if (errors?.length) {
    const errorMessage = `Following SSM parameters do not exist: ${errors.join(", ")}`;
    throw new Error(errorMessage);
  }

  return {
    otg: {
      apiUrl: ssmParams[otgParamName],
    },
    pdv: {
      apiUrl: ssmParams[pdvParamName],
      userAgent: ssmParams[pdvUserAgentParamName],
    },
  };
}

export async function saveTxn(dynamoClient: DynamoDBClient, sessionTableName: string, sessionId: string, txn: string) {
  const txnCmd = new UpdateItemCommand({
    TableName: sessionTableName,
    Key: marshall({ sessionId }),
    UpdateExpression: `SET txn=:txn`,
    ExpressionAttributeValues: marshall({ ":txn": txn }),
  });

  const txnRes = await dynamoClient.send(txnCmd);

  logger.info(`Saved txn to session table: ${txnRes.$metadata.httpStatusCode}.`);
}

async function saveAttempt(
  dynamoClient: DynamoDBClient,
  attemptTableName: string,
  session: NinoSessionItem,
  matchOutcome: "PASS" | "FAIL",
  status: number,
  error?: string
) {
  const newAttempt: AttemptItem = {
    sessionId: session.sessionId,
    timestamp: new Date().toISOString() as ISO8601DateString,
    status: status.toString(),
    attempt: matchOutcome,
    text: error,
    ttl: session.expiryDate,
  };

  const putAttemptCmd = new PutItemCommand({
    TableName: attemptTableName,
    Item: marshall(newAttempt, { removeUndefinedValues: true }),
  });

  const attemptRes = await dynamoClient.send(putAttemptCmd);

  logger.info(`Saved attempt: ${attemptRes.$metadata.httpStatusCode}`);
}

export async function handleResponseAndSaveAttempt(
  dynamoClient: DynamoDBClient,
  attemptTableName: string,
  session: NinoSessionItem,
  pdvRes: PdvFunctionOutput
): Promise<boolean> {
  const responseStatus = pdvRes.httpStatus;

  if (responseStatus === 200) {
    captureMetric(`SuccessfulFirstAttemptMetric`);
    await saveAttempt(dynamoClient, attemptTableName, session, "PASS", pdvRes.httpStatus);
    return true;
  }

  if (pdvRes.httpStatus === 401 && "errors" in (pdvRes.parsedBody ?? {})) {
    logger.info(`Failed PDV match received.`);
    const errorText = (pdvRes.parsedBody as PdvApiErrorBody).errors;
    await saveAttempt(dynamoClient, attemptTableName, session, "FAIL", pdvRes.httpStatus, errorText);
    return false;
  }

  if (pdvRes.httpStatus === 424) {
    captureMetric(`DeceasedUserMetric`);
    logger.info(`Deceased response received`);
    await saveAttempt(dynamoClient, attemptTableName, session, "FAIL", pdvRes.httpStatus, pdvRes.body);
    return false;
  }

  if (pdvRes.parsedBody && "code" in pdvRes.parsedBody && pdvRes.parsedBody?.code === "INVALID_CREDENTIALS") {
    captureMetric(`FailedHMRCAuthMetric`);
    logger.info(
      `Failed to authenticate with HMRC API: response had a code of ${pdvRes.parsedBody.code} & http status of ${pdvRes.httpStatus}`
    );
    throw new CriError(500, "Failed to authenticate with HMRC API");
  }

  captureMetric(`HMRCAPIErrorMetric`);
  logger.info(`Received an unexpected error response from the PDV API - status: ${responseStatus}`);
  throw new CriError(500, "Unexpected error with the PDV API");
}
