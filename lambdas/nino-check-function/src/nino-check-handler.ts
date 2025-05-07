import { LambdaInterface } from "@aws-lambda-powertools/commons";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { isSessionExpired, querySession } from "./session-check";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SessionItem } from "./session-item";
import { Logger } from "@aws-lambda-powertools/logger";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { extractName, Names } from "./person-identity";
import {
  CloudWatchEventsClient,
  PutEventsCommand,
} from "@aws-sdk/client-cloudwatch-events";
import { LogHelper } from "../../logging/log-helper";
import { randomUUID } from "crypto";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const eventsClient = new CloudWatchEventsClient({});

interface SSMParameters {
  otgUrl: string;
  personIdentityTableName: string;
  userAgent: string;
  sessionTableName: string;
  ninoCheckUrl: string;
  verifiableCredentialIssuer: string;
}

export class NinoCheckHandler implements LambdaInterface {
  public async handler(
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> {
    logger.info(`Entry ${context.functionName}`);

    const logHelper = new LogHelper(context, logger);
    let govuk_signin_journey_id = "";

    try {
      const { nino } = JSON.parse(event.body ?? "");
      const sessionId = event.headers["session-id"] ?? "";

      /** Check session */
      const sessionItem = await fetchSessionRecord(sessionId);
      if (!sessionItem || isSessionExpired(sessionItem)) {
        logger.info("Session expired for session-id: " + sessionId);
        return http400();
      }

      logger.info("Found session item for session-id: " + sessionId);

      const userAuditInfo: Record<string, string> = {
        govuk_signin_journey_id: sessionItem.clientSessionId,
        ip_address: sessionItem.clientIpAddress,
        session_id: sessionId,
        user_id: sessionItem.subject,
      };
      if (sessionItem.persistentSessionId) {
        userAuditInfo.persistent_session_id = sessionItem.persistentSessionId;
      }
      govuk_signin_journey_id = userAuditInfo.govuk_signin_journey_id;
      logHelper.logEntry(context.functionName, govuk_signin_journey_id);

      const txmaAuditHeader = event.headers["txma-audit-encoded"];

      /** Fetch SSM parameters */
      const ssmParameters = await fetchSSMParameters(sessionItem.clientId);

      /** Query user attempts */
      const attempts = await getUserAttempts(sessionId);

      if (attempts >= 2) {
        logger.info("User has exceeded the number of allowed attempts");
        return http200(false);
      }

      /** Query Person Identity Table */
      const { personIdentityRecord, userResult } =
        await queryPersonIdentityTable(
          ssmParameters.personIdentityTableName,
          sessionId
        );

      /** Call OTG API */
      const token = await callOtgAPI(ssmParameters.otgUrl);

      /** Send Audit Event (Request Sent) */
      // logger.info("Sending audit event REQUEST_SENT");
      // await eventsClient.send(
      //   new PutEventsCommand({
      //     Entries: [
      //       {
      //         Detail: JSON.stringify({
      //           auditPrefix: process.env.AuditEventPrefix,
      //           user: userAuditInfo,
      //           deviceInformation: txmaAuditHeader,
      //           nino: nino,
      //           userInfoEvent: userResult,
      //           issuer: ssmParameters.verifiableCredentialIssuer,
      //         }),
      //         DetailType: process.env.AuditEventNameRequestSent,
      //         EventBusName: process.env.CheckHmrcEventBus,
      //         Source: process.env.CheckHmrcEventBusSource,
      //       },
      //     ],
      //   })
      // );

      /** Call Matching API  */
      const names = extractName(personIdentityRecord.names);
      const dob = personIdentityRecord.birthDates.L[0].M.value.S;
      const matchingResponse = await callMatchingAPI(
        ssmParameters.ninoCheckUrl,
        token,
        ssmParameters.userAgent,
        names.firstName,
        names.lastName,
        dob,
        nino
      );

      /** Store txn */
      const txn = matchingResponse.headers.get("x-amz-cf-id");

      await saveTxn(ssmParameters.sessionTableName, sessionId, txn);

      /** Send Audit Event (Response Received) */
      //logger.info("Sending audit event RESPONSE_RECEIVED");
      //
      // await eventsClient.send(
      //   new PutEventsCommand({
      //     Entries: [
      //       {
      //         Detail: JSON.stringify({
      //           auditPrefix: process.env.AuditEventPrefix,
      //           user: userAuditInfo,
      //           deviceInformation: txmaAuditHeader,
      //           issuer: ssmParameters.verifiableCredentialIssuer,
      //           evidence: [{ txn: txn }],
      //         }),
      //         DetailType: process.env.AuditEventNameResponseReceived,
      //         EventBusName: process.env.CheckHmrcEventBus,
      //         Source: process.env.CheckHmrcEventBusSource,
      //       },
      //     ],
      //   })
      // );

      /** Handle HMRC Response */
      const passed = await handleMatchingResponse(
        matchingResponse,
        sessionItem
      );

      if (!passed && attempts == 0) {
        logger.info("User failed their first attempt, allowing re-try!");
        return http200(true);
      }

      /** Set Auth Code and Expiry */
      const storeAuthPromise = storeAuthorizationCode(
        ssmParameters.sessionTableName,
        sessionItem.sessionId
      );

      /** Save NINO & sessionId */
      const storeNinoPromise = saveNinoToUserAttemptsTable(
        sessionItem.sessionId,
        nino,
        sessionItem.expiryDate
      );

      await Promise.all([storeAuthPromise, storeNinoPromise]);

      logger.info("User has passed the NINO check!");

      return http200(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logHelper.logError(
        context.functionName,
        govuk_signin_journey_id,
        "An error occurred inside nino-check-handler: " + message
      );
      return http500();
    }
  }
}

async function fetchSessionRecord(sessionId: string) {
  logger.info("Checking session " + sessionId);

  if (!sessionId) {
    return null;
  }

  const sessionQuery = await querySession(sessionId);
  if ((sessionQuery.Count || 0) <= 0) {
    logger.info("No session item found for session-id: " + sessionId);
    return null;
  }

  const sessionQueryResult = sessionQuery.Items?.map((item) => ({
    sessionId: item.sessionId.S,
    clientSessionId: item.clientSessionId.S,
    clientIpAddress: item.clientIpAddress.S,
    subject: item.subject.S,
    clientId: item.clientId.S,
    expiryDate: item.expiryDate.N,
    persistentSessionId: item.persistentSessionId?.S,
  }));

  return (sessionQueryResult ? sessionQueryResult[0] : null) as SessionItem;
}

async function getUserAttempts(sessionId: string) {
  logger.info("Querying user attempts table");
  const attemptsQuery = new QueryCommand({
    TableName: process.env.UserAttemptsTable,
    KeyConditionExpression: "sessionId = :value",
    ExpressionAttributeValues: {
      ":value": {
        S: sessionId,
      },
    },
  });
  const attemptsResult = await dynamoClient.send(attemptsQuery);
  return attemptsResult.Count || 0;
}

async function fetchSSMParameters(clientId: string) {
  logger.info("Fetching SSM parameters");

  const parameterKeyMap: Record<string, string> = {
    otgUrl: `/check-hmrc-cri-api/OtgUrl/${clientId}`,
    personIdentityTableName: `/${process.env.CommonStackName}/PersonIdentityTableName`,
    userAgent: `${process.env.UserAgent}`,
    sessionTableName: `/${process.env.CommonStackName}/SessionTableName`,
    ninoCheckUrl: `/check-hmrc-cri-api/NinoCheckUrl/${clientId}`,
    verifiableCredentialIssuer: `/${process.env.CommonStackName}/verifiable-credential/issuer`,
  };

  const parameterNames = Object.values(parameterKeyMap);

  const { _errors: errors, ...fetchedParameters } =
    await getParametersByName<string>(
      Object.fromEntries(parameterNames.map((name) => [name, {}])),
      { maxAge: 300, throwOnError: false }
    );

  if (errors?.length) {
    throw new Error(`Missing SSM parameters: ${errors.join(", ")}`);
  }

  return Object.fromEntries(
    Object.entries(parameterKeyMap).map(([key, ssmName]) => [
      key,
      fetchedParameters[ssmName],
    ])
  ) as unknown as SSMParameters;
}

async function queryPersonIdentityTable(
  personIdentityTableName: string,
  sessionId: string
) {
  logger.info("Querying Person Identity Table");

  const userQuery = new QueryCommand({
    TableName: personIdentityTableName,
    KeyConditionExpression: "sessionId = :value",
    ExpressionAttributeValues: {
      ":value": {
        S: sessionId,
      },
    },
  });

  const userResult = await dynamoClient.send(userQuery);
  const userItems =
    userResult.Items?.map((item) => ({
      names: item.names as Names,
      birthDates: item.birthDates as {
        L: [{ M: { value: { S: string } } }];
      },
    })) || [];

  if (userItems.length === 0) {
    throw new Error("No PersonIdentity record found for sessionId" + sessionId);
  }

  return {
    personIdentityRecord: userItems[0],
    userResult: userResult,
  };
}

async function callOtgAPI(otgUrl: string) {
  logger.info("Calling OTG API");

  const otgResponse = await fetch(otgUrl, {
    method: "GET",
  });

  if (!otgResponse.ok) {
    throw new Error(
      "Failed to call OTG API - response was: " + otgResponse.status
    );
  }

  const response = await otgResponse.json();
  return response.token;
}

async function callMatchingAPI(
  ninoCheckUrl: string,
  token: string,
  userAgent: string,
  firstName: string,
  lastName: string,
  dob: string,
  nino: string
) {
  logger.info("Calling HMRC PDV Matching API");

  return await fetch(ninoCheckUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      firstName: firstName,
      lastName: lastName,
      dateOfBirth: dob,
      nino: nino,
    }),
  });
}

async function saveTxn(
  sessionTableName: string,
  sessionId: string,
  txn: string | null
) {
  if (!txn) {
    return;
  }
  logger.info("Storing txn received from HMRC");

  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: sessionTableName,
      Key: {
        sessionId: {
          S: sessionId,
        },
      },
      UpdateExpression: "SET txn = :txn",
      ExpressionAttributeValues: {
        ":txn": {
          S: txn,
        },
      },
    })
  );
}

async function handleMatchingResponse(
  matchingResponse: Response,
  sessionItem: SessionItem
) {
  logger.info("Handling matching response");

  const body = await matchingResponse.text();
  const json = JSON.parse(body);

  if (matchingResponse.status == 200) {
    logger.info("Storing user attempt as PASS");
    await storeUserAttempt(
      sessionItem.sessionId,
      matchingResponse.status.toString(),
      body,
      sessionItem.expiryDate,
      "PASS"
    );
    return true;
  } else if (
    matchingResponse.status === 401 ||
    matchingResponse.status === 424
  ) {
    logger.info("Storing user attempt as FAIL");
    await storeUserAttempt(
      sessionItem.clientSessionId,
      matchingResponse.status.toString(),
      body,
      sessionItem.expiryDate,
      "FAIL"
    );
    return false;
  } else if (json.code === "INVALID_CREDENTIALS") {
    // perhaps call OTG again and re-try
    throw new Error("Matching API responded with INVALID_CREDENTIALS");
  } else {
    // retry 3x before throwing?
    throw new Error(
      "Matching API responded with unexpected status " + matchingResponse.status
    );
  }
}

async function storeUserAttempt(
  sessionId: string,
  status: string,
  body: string,
  expiryDate: string,
  attempt: string
) {
  logger.info("Storing user attempt into database");

  await dynamoClient.send(
    new PutItemCommand({
      TableName: process.env.UserAttemptsTable,
      Item: {
        sessionId: {
          S: sessionId,
        },
        timestamp: {
          S: Math.floor(Date.now() / 1000).toString(),
        },
        status: {
          S: status,
        },
        text: {
          S: body,
        },
        attempt: {
          S: attempt,
        },
        ttl: {
          N: expiryDate,
        },
      },
    })
  );
}

async function storeAuthorizationCode(
  sessionTableName: string,
  sessionId: string
) {
  logger.info("Storing auth code and expiry");

  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: sessionTableName,
      Key: {
        sessionId: {
          S: sessionId,
        },
      },
      UpdateExpression:
        "SET authorizationCode = :authCode, authorizationCodeExpiryDate = :expiry",
      ExpressionAttributeValues: {
        ":authCode": {
          S: randomUUID(),
        },
        ":expiry": {
          N: (Math.floor(Date.now() / 1000) + 600).toString(),
        },
      },
    })
  );
}

async function saveNinoToUserAttemptsTable(
  sessionId: string,
  nino: string,
  expiryDate: string
) {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: process.env.NinoUsersTable,
      Item: {
        sessionId: {
          S: sessionId,
        },
        nino: {
          S: nino,
        },
        ttl: {
          S: expiryDate,
        },
      },
    })
  );
}

function http400() {
  return {
    statusCode: 400,
    body: "",
  };
}

function http500() {
  return {
    statusCode: 500,
    body: "",
  };
}

function http200(requestRetry: boolean) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      requestRetry: requestRetry,
    }),
  };
}

const handlerClass = new NinoCheckHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
