import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import * as zlib from "zlib";
import { CloudWatchLogsDecodedData } from "aws-lambda";
import { CloudWatchLogsEvent } from "aws-lambda/trigger/cloudwatch-logs";
import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  PutLogEventsCommandOutput,
  CreateLogStreamCommand,
  ResourceAlreadyExistsException,
} from "@aws-sdk/client-cloudwatch-logs";
import { redactPII } from "./pii-redactor";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { initOpenTelemetry } from "../../open-telemetry/src/otel-setup";

initOpenTelemetry();

const logger = new Logger();
const cloudwatch = new CloudWatchLogsClient();

const logStreamTrackingTable = process.env.RedactionLogStreamTrackingTable;

export class PiiRedactHandler implements LambdaInterface {
  private readonly dynamodb: DynamoDBClient;

  constructor(dynamodb = new DynamoDBClient()) {
    this.dynamodb = dynamodb;
  }

  public async handler(
    event: CloudWatchLogsEvent,
    _context: unknown
  ): Promise<object> {
    try {
      logger.info("Received " + JSON.stringify(event));

      const logDataBase64 = event.awslogs.data;
      const logDataBuffer = Buffer.from(logDataBase64, "base64");
      const decompressedData = zlib.unzipSync(logDataBuffer).toString("utf-8");
      const logEvents: CloudWatchLogsDecodedData = JSON.parse(decompressedData);
      const piiRedactLogGroup = logEvents.logGroup + "-pii-redacted";
      const logStream = logEvents.logStream;

      await this.createLogStream(logStream, piiRedactLogGroup);

      for (const logEvent of logEvents.logEvents) {
        logEvent.message = redactPII(logEvent.message);
      }

      await this.saveRedactedLog(piiRedactLogGroup, logStream, logEvents);

      return {};
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error in PiiRedactHandler: ${message}`);
      throw error;
    }
  }

  private async saveRedactedLog(
    redactLogGroup: string,
    logStream: string,
    logEvents: CloudWatchLogsDecodedData
  ) {
    logger.info("Putting redacted logs into " + redactLogGroup);

    try {
      const response: PutLogEventsCommandOutput = await cloudwatch.send(
        new PutLogEventsCommand({
          logGroupName: redactLogGroup,
          logStreamName: logStream,
          logEvents: logEvents.logEvents.map((event) => ({
            id: event.id,
            message: this.formatMessage(event.message),
            timestamp: event.timestamp,
            extractedFields: event.extractedFields,
          })),
        })
      );
      logger.info(JSON.stringify(response));
    } catch (error) {
      logger.error(`Error putting log events into ${redactLogGroup}: ${error}`);
      throw error;
    }
  }

  private async createLogStream(logStreamName: string, logGroupName: string) {
    if (!(await this.logStreamExists(logStreamName))) {
      logger.info("Creating log stream " + logStreamName);

      try {
        await cloudwatch.send(
          new CreateLogStreamCommand({
            logStreamName: logStreamName,
            logGroupName: logGroupName,
          })
        );
      } catch (error: unknown) {
        if (error instanceof ResourceAlreadyExistsException) {
          logger.info(logStreamName + " already exists");
        }
      }

      await this.saveLogStreamRecordInDB(logStreamName);
      logger.info("Added " + logStreamName + " to " + logStreamTrackingTable);
    }
  }

  private saveLogStreamRecordInDB(logStream: string) {
    return this.dynamodb.send(
      new PutItemCommand({
        TableName: logStreamTrackingTable,
        Item: {
          logStreamName: {
            S: logStream,
          },
          expiryDate: {
            N: (Math.floor(Date.now() / 1000) + 120 * 60).toString(),
          },
        },
      })
    );
  }

  private async logStreamExists(logStream: string) {
    const query = await this.dynamodb.send(
      new QueryCommand({
        TableName: logStreamTrackingTable,
        KeyConditionExpression: "logStreamName = :logStream",
        ExpressionAttributeValues: {
          ":logStream": {
            S: logStream,
          },
        },
      })
    );
    return query.Count !== 0;
  }

  private formatMessage(message: string) {
    try {
      return JSON.stringify(JSON.parse(message), null, 2);
    } catch (error) {
      return message;
    }
  }
}

const handlerClass = new PiiRedactHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
