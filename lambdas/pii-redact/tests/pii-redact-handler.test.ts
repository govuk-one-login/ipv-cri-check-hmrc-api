import { PiiRedactHandler } from "../src/pii-redact-handler";
import * as zlib from "node:zlib";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import mocked = jest.mocked;
import { ResourceAlreadyExistsException } from "@aws-sdk/client-cloudwatch-logs";
import { mockLogger } from "./utils";

let throwMockError: null | "Error" | "ResourceAlreadyExistsException" = null;

jest.mock("@aws-sdk/client-cloudwatch-logs", () => {
  const actual = jest.requireActual("@aws-sdk/client-cloudwatch-logs");
  return {
    ...actual,
    CloudWatchLogsClient: jest.fn(() => ({
      send: jest.fn().mockImplementation((command) => {
        if (command instanceof actual.CreateLogStreamCommand) {
          switch (throwMockError) {
            case "ResourceAlreadyExistsException": {
              throw new ResourceAlreadyExistsException({
                $metadata: {},
                message: "Resource already exists!",
              });
            }
            case "Error": {
              throw new Error("Error creating log stream");
            }
          }
        }

        return {
          message: "",
        };
      }),
    })),
  };
});

describe("pii-redact-handler", () => {
  async function encode(payload: string) {
    return await new Promise<string>((resolve, reject) => {
      zlib.deflate(payload, (_, compressedData) => {
        if (compressedData) {
          const compressedString =
            Buffer.from(compressedData).toString("binary");
          const base64CompressedEvent = Buffer.from(
            compressedString,
            "binary"
          ).toString("base64");
          resolve(base64CompressedEvent);
        } else {
          reject(new Error("Failed to compress data"));
        }
      });
    });
  }

  beforeEach(() => {
    throwMockError = null;
  });

  it("should not fail when running the handler", async () => {
    const mockDynamoDbClient = mocked(DynamoDBClient);
    mockDynamoDbClient.prototype.send = jest.fn().mockReturnValue({
      Count: 0,
    });

    const piiData = {
      owner: undefined,
      logGroup: "dummy-log-group",
      logStream: "dummy-log-stream",
      subscriptionFilters: undefined,
      messageType: undefined,
      logEvents: [
        {
          id: undefined,
          timestamp: undefined,
          message: "{}",
          extractedFields: undefined,
        },
      ],
    };
    const compressedData = await encode(JSON.stringify(piiData));
    const event = {
      awslogs: {
        data: compressedData,
      },
    };
    const handler = new PiiRedactHandler(
      mockDynamoDbClient.prototype,
      mockLogger
    );
    const result = await handler.handler(event, {});
    expect(result).toStrictEqual({});
  });

  it("should throw when an error occurs creating a log stream", async () => {
    const mockDynamoDbClient = mocked(DynamoDBClient);
    mockDynamoDbClient.prototype.send = jest.fn().mockReturnValue({
      Count: 0,
    });
    throwMockError = "Error";
    const piiData = {
      owner: undefined,
      logGroup: "dummy-log-group",
      logStream: "dummy-log-stream",
      subscriptionFilters: undefined,
      messageType: undefined,
      logEvents: [
        {
          id: undefined,
          timestamp: undefined,
          message: "{}",
          extractedFields: undefined,
        },
      ],
    };
    const compressedData = await encode(JSON.stringify(piiData));
    const event = {
      awslogs: {
        data: compressedData,
      },
    };
    const handler = new PiiRedactHandler(
      mockDynamoDbClient.prototype,
      mockLogger
    );

    await expect(handler.handler(event, {})).rejects.toThrow(
      new Error("Error creating log stream")
    );
  });

  it("should not throw when a ResourceAlreadyExistsException error occurs creating a log stream", async () => {
    const mockDynamoDbClient = mocked(DynamoDBClient);
    mockDynamoDbClient.prototype.send = jest.fn().mockReturnValue({
      Count: 0,
    });
    throwMockError = "ResourceAlreadyExistsException";
    const piiData = {
      owner: undefined,
      logGroup: "dummy-log-group",
      logStream: "dummy-log-stream",
      subscriptionFilters: undefined,
      messageType: undefined,
      logEvents: [
        {
          id: undefined,
          timestamp: undefined,
          message: "{}",
          extractedFields: undefined,
        },
      ],
    };
    const compressedData = await encode(JSON.stringify(piiData));
    const event = {
      awslogs: {
        data: compressedData,
      },
    };
    const handler = new PiiRedactHandler(
      mockDynamoDbClient.prototype,
      mockLogger
    );

    const result = await handler.handler(event, {});
    expect(result).toStrictEqual({});
  });

  it("should create log stream when does not exist", async () => {
    const mockDynamoDbClient = mocked(DynamoDBClient);
    mockDynamoDbClient.prototype.send = jest.fn().mockReturnValue({
      Count: 0,
    });

    const piiData = {
      owner: undefined,
      logGroup: "dummy-log-group",
      logStream: "dummy-log-stream",
      subscriptionFilters: undefined,
      messageType: undefined,
      logEvents: [
        {
          id: undefined,
          timestamp: undefined,
          message: "{}",
          extractedFields: undefined,
        },
      ],
    };
    const compressedData = await encode(JSON.stringify(piiData));
    const event = {
      awslogs: {
        data: compressedData,
      },
    };
    const handler = new PiiRedactHandler(
      mockDynamoDbClient.prototype,
      mockLogger
    );
    const result = await handler.handler(event, {});

    expect(result).toStrictEqual({});
  });

  it("should try not create log stream when it already exists", async () => {
    const mockDynamoDbClient = mocked(DynamoDBClient);
    mockDynamoDbClient.prototype.send = jest.fn().mockReturnValue({
      Count: 1,
    });

    const piiData = {
      owner: undefined,
      logGroup: "dummy-log-group",
      logStream: "dummy-log-stream",
      subscriptionFilters: undefined,
      messageType: undefined,
      logEvents: [
        {
          id: undefined,
          timestamp: undefined,
          message: "{}",
          extractedFields: undefined,
        },
      ],
    };
    const compressedData = await encode(JSON.stringify(piiData));
    const event = {
      awslogs: {
        data: compressedData,
      },
    };
    const handler = new PiiRedactHandler(
      mockDynamoDbClient.prototype,
      mockLogger
    );
    const result = await handler.handler(event, {});

    expect(result).toStrictEqual({});
  });
});
