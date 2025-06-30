import { randomUUID } from "crypto";
import { TimeUnits, toEpochSecondsFromNow } from "../utils/date-time";
import { TableNames } from "../types/input";
import { marshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { NinoUser } from "../types/nino-user";
import { logger } from "../../../common/src/util/logger";

export async function writeCompletedCheck(
  dynamoClient: DynamoDBClient,
  { sessionTable, ninoUserTable }: TableNames,
  sessionId: string,
  nino: string
) {
  const authCode = randomUUID();
  const authCodeExpiryDate = toEpochSecondsFromNow(10, TimeUnits.Minutes);

  const authCodeCmd = new UpdateItemCommand({
    TableName: sessionTable,
    Key: marshall({ sessionId }),
    UpdateExpression: `SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry`,
    ExpressionAttributeValues: marshall({
      ":authCode": authCode,
      ":authCodeExpiry": authCodeExpiryDate,
    }),
  });

  const authCodeRes = await dynamoClient.send(authCodeCmd);

  logger.info(`Saved auth code: ${authCodeRes.$metadata.httpStatusCode}`);

  const newNinoUser: NinoUser = {
    sessionId,
    nino,
  };

  const putNinoUserCmd = new PutItemCommand({
    TableName: ninoUserTable,
    Item: marshall(newNinoUser),
  });
  const ninoUserRes = await dynamoClient.send(putNinoUserCmd);

  logger.info(`Saved nino-user: ${ninoUserRes.$metadata.httpStatusCode}`);
}
