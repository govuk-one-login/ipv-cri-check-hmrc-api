import { SessionItem, ISO8601DateString } from "@govuk-one-login/cri-types";
import { PdvApiErrorJSON, PdvApiErrorBody, ParsedPdvMatchResponse } from "../../../common/src/hmrc-apis/types/pdv";
import { marshall } from "@aws-sdk/util-dynamodb";
import { CriError } from "../../../common/src/errors/cri-error";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { AttemptItem } from "../../../common/src/types/attempt";
import { logger } from "@govuk-one-login/cri-logger";
import { captureMetric } from "../../../common/src/util/metrics";

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
  session: SessionItem,
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
  session: SessionItem,
  pdvMatchResponse: ParsedPdvMatchResponse
): Promise<boolean> {
  const responseHttpStatus = pdvMatchResponse.httpStatus;

  if (responseHttpStatus === 200) {
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
    logger.info(
      `Failed to authenticate with HMRC API: response had a code of ${parsedErrorBody.errorMessage} & http status of ${responseHttpStatus}`
    );
    throw new CriError(500, "Failed to authenticate with HMRC API");
  }

  logger.info(`Received an unexpected error response from the PDV API - status: ${responseHttpStatus}`);
  throw new CriError(500, "Unexpected error with the PDV API");
}

function isErrorResponse(response: PdvApiErrorBody): response is PdvApiErrorJSON {
  return typeof response !== "string" && response.type === "matching_error";
}

function isInvalidCredentialResponse(response: PdvApiErrorBody): response is PdvApiErrorJSON {
  return typeof response !== "string" && response.type === "invalid_creds";
}
