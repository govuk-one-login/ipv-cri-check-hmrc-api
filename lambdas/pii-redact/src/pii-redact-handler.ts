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
} from "@aws-sdk/client-cloudwatch-logs";

const logger = new Logger();
const cloudwatch = new CloudWatchLogsClient();

const ninoRegex = /\\"nino\\":\s*\\"([^"]*)\\"/g;
const ipAddressRegex = /\\"ip_address\\":\s*\\"([^"]*)\\"/g;
const userIdRegex = /\\"user_id\\":\s*\\"([^"]*)\\"/g;
const firstNameRegex = /\\"firstName\\":\s*\\"([^"]*)\\"/g;
const lastNameRegex = /\\"lastName\\":\s*\\"([^"]*)\\"/g;
const birthDates =
  /\\"birthDates\\"\s*:\s*\{\s*\\"L\\"\s*:\s*\[\s*\{\s*\\"M\\"\s*:\s*\{\s*\\"value\\"\s*:\s*\{\s*\\"S\\"\s*:\s*\\"(\d{4}-\d{2}-\d{2})\\"\s*}\s*}\s*}\s*]\s*}/g;
const subjectRegex = /\\"subject\\":\s*\\"([^"]*)\\"/g;
const tokenRegex = /\\"token\\":\s*\\"([^"]*)\\"/g;
const dateOfBirthRegex = /\\"dateOfBirth\\":\s*\\"([^"]*)\\"/g;

const buildingNameRegex =
  /\\"buildingName\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const addressLocalityRegex =
  /\\"addressLocality\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const buildingNumberRegex =
  /\\"buildingNumber\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const postalCodeRegex =
  /\\"postalCode\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;
const streetNameRegex =
  /\\"streetName\\"\s*:\s*{\s*\\"S\\"\s*:\s*\\"([^"]*)\\"/g;

const givenNameRegex =
  /\\"type\\":{\\"S\\":\\"GivenName\\"},\s*\\"value\\":{\\"S\\":\\"([^"]*)\\"/g;
const familyNameRegex =
  /\\"type\\":{\\"S\\":\\"FamilyName\\"},\s*\\"value\\":{\\"S\\":\\"([^"]*)\\"/g;

export class PiiRedactHandler implements LambdaInterface {
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

      try {
        await cloudwatch.send(
          new CreateLogStreamCommand({
            logGroupName: piiRedactLogGroup,
            logStreamName: logStream,
          })
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("The specified log stream already exists")) {
          throw error;
        }
        logger.info(logStream + " already exists");
      }

      for (const logEvent of logEvents.logEvents) {
        logEvent.message = this.redactPII(logEvent.message);
      }

      logger.info("Putting redacted logs into " + piiRedactLogGroup);

      try {
        const response: PutLogEventsCommandOutput = await cloudwatch.send(
          new PutLogEventsCommand({
            logGroupName: piiRedactLogGroup,
            logStreamName: logStream,
            logEvents: logEvents.logEvents.map((event) => ({
              message: event.message,
              timestamp: event.timestamp,
            })),
          })
        );
        logger.info(JSON.stringify(response));
      } catch (error) {
        logger.error(
          `Error putting log events into ${piiRedactLogGroup}: ${error}`
        );
        throw error;
      }

      return {};
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error in PiiRedactHandler: ${message}`);
      throw error;
    }
  }

  public redactPII(message: string): string {
    return message
      .replaceAll(userIdRegex, '"user_id": "***"')
      .replaceAll(dateOfBirthRegex, '"dateOfBirth": "***"')
      .replaceAll(firstNameRegex, '"firstName": "***"')
      .replaceAll(lastNameRegex, '"lastName": "***"')
      .replaceAll(birthDates, '"birthDates": "***"')
      .replaceAll(buildingNameRegex, '"buildingName": { "S": "***"')
      .replaceAll(addressLocalityRegex, '"addressLocality": { "S": "***"')
      .replaceAll(buildingNumberRegex, '"buildingNumber": { "S": "***"')
      .replaceAll(postalCodeRegex, '"postalCode": { "S": "***"')
      .replaceAll(streetNameRegex, '"streetName": { "S": "***"')
      .replaceAll(subjectRegex, '"subject": "***"')
      .replaceAll(
        givenNameRegex,
        '"type": { "S": "GivenName" }, "value": { "S": "***"'
      )
      .replaceAll(
        familyNameRegex,
        '"type": { "S": "FamilyName" }, "value": { "S": "***"'
      )
      .replaceAll(ninoRegex, '"nino": "***"')
      .replaceAll(ipAddressRegex, '"ip_address": "***"')
      .replaceAll(tokenRegex, '"token": "***"');
  }
}

const handlerClass = new PiiRedactHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
