import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { ISO8601DateString } from "../../../common/src/types/brands";
import { PdvApiErrorJSON, PdvApiErrorBody, ParsedPdvMatchResponse, PdvConfig } from "../hmrc-apis/types/pdv";
import { marshall } from "@aws-sdk/util-dynamodb";
import { CriError } from "../../../common/src/errors/cri-error";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { AttemptItem } from "../../../common/src/types/attempt";
import { logger } from "../../../common/src/util/logger";
import { NinoSessionItem } from "../../../common/src/types/nino-session-item";
import { captureMetric } from "../../../common/src/util/metrics";
import { OtgConfig } from "../hmrc-apis/types/otg";

export type HmrcApiConfig = {
  otg: OtgConfig;
  pdv: PdvConfig;
};

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
    throw new CriError(500, errorMessage);
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
  pdvMatchResponse: ParsedPdvMatchResponse
): Promise<boolean> {
  const responseHttpStatus = pdvMatchResponse.httpStatus;

  if (responseHttpStatus === 200) {
    captureMetric(`SuccessfulFirstAttemptMetric`);
    await saveAttempt(dynamoClient, attemptTableName, session, "PASS", responseHttpStatus);
    return true;
  }

  const parsedErrorBody = pdvMatchResponse.errorBody;

  if (responseHttpStatus === 401 && isErrorResponse(parsedErrorBody)) {
    logger.info(`Failed PDV match received.`);
    await saveAttempt(
      dynamoClient,
      attemptTableName,
      session,
      "FAIL",
      responseHttpStatus,
      parsedErrorBody.errorMessage
    );
    return false;
  }

  if (responseHttpStatus === 424 && typeof parsedErrorBody === "string") {
    captureMetric(`DeceasedUserMetric`);
    logger.info(`Deceased response received`);
    await saveAttempt(dynamoClient, attemptTableName, session, "FAIL", responseHttpStatus, parsedErrorBody);
    return false;
  }

  if (isInvalidCredentialResponse(parsedErrorBody)) {
    captureMetric(`FailedHMRCAuthMetric`);
    logger.info(
      `Failed to authenticate with HMRC API: response had a code of ${parsedErrorBody.errorMessage} & http status of ${responseHttpStatus}`
    );
    throw new CriError(500, "Failed to authenticate with HMRC API");
  }

  captureMetric(`HMRCAPIErrorMetric`);
  logger.info(`Received an unexpected error response from the PDV API - status: ${responseHttpStatus}`);
  throw new CriError(500, "Unexpected error with the PDV API");
}

function isErrorResponse(response: PdvApiErrorBody): response is PdvApiErrorJSON {
  return typeof response !== "string" && response.type === "matching_error";
}

function isInvalidCredentialResponse(response: PdvApiErrorBody): response is PdvApiErrorJSON {
  return typeof response !== "string" && response.type === "invalid_creds";
}
