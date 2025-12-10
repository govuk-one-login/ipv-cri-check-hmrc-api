import { mockLogger } from "../../common/tests/logger";
jest.mock("../../common/src/util/logger", () => ({
  logger: mockLogger,
}));
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { APIGatewayProxyEvent, APIGatewayProxyEventHeaders, Context } from "aws-lambda";

process.env.SESSION_TABLE = "session-table";
process.env.ISSUER = "issuer";
process.env.AUDIT_QUEUE_URL = "cool-queuez.com";
process.env.AUDIT_COMPONENT_ID = "https://check-hmrc-time.account.gov.uk";
import { AbandonHandler } from "../src/abandon-handler";

jest.mock("../../common/src/util/audit");
import { sendAuditEvent } from "../../common/src/util/audit";

const auditConfig = {
  queueUrl: "cool-queuez.com",
  componentId: "https://check-hmrc-time.account.gov.uk",
};

xdescribe("abandon-handler", () => {
  const ddbMock = mockClient(DynamoDBClient);

  const now = Math.round(Date.now() / 1000);
  const anHourFromNow = now + 60 * 60;

  beforeEach(() => {
    ddbMock.reset();
    jest.clearAllMocks();
  });

  it("should successfully return 200", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          sessionId: { S: "session-123" },
          clientSessionId: { S: "gov-123" },
          expiryDate: { N: anHourFromNow.toString() },
          clientId: { S: "dummy" },
          authorizationCodeExpiryDate: { N: "0" },
          redirectUri: { S: "dummy" },
          accessToken: { S: "dummy" },
          accessTokenExpiryDate: { N: anHourFromNow.toString() },
          clientIpAddress: { S: "192.0.0.1" },
          subject: { S: "user-id" },
          persistentSessionId: { S: "persisent-id" },
        },
      ],
      Count: 1,
    });

    ddbMock.on(UpdateItemCommand).resolves({});

    const event = {
      body: JSON.stringify({}),
      headers: {
        ["session-id"]: "session-123",
        ["txma-audit-encoded"]: "txmaAuditHeader",
      } as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result.statusCode).toEqual(200);
    expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
      ExpressionAttributeValues: {
        ":value": { S: "session-123" },
        ":expiry": { N: expect.stringMatching(/\d+/) },
      },
      KeyConditionExpression: "sessionId = :value",
      FilterExpression: "#expiry > :expiry",
      ExpressionAttributeNames: {
        "#expiry": "expiryDate",
      },
      TableName: "session-table",
    });
    expect(ddbMock).toHaveReceivedCommandWith(UpdateItemCommand, {
      ExpressionAttributeValues: { ":expiry": { N: "0" } },
      Key: { sessionId: { S: "session-123" } },
      TableName: "session-table",
      UpdateExpression: "SET authorizationCodeExpiryDate = :expiry REMOVE authorizationCode",
    });
    expect(sendAuditEvent).toHaveBeenCalledWith(
      "ABANDONED",
      auditConfig,
      {
        sessionId: "session-123",
        clientSessionId: "gov-123",
        expiryDate: anHourFromNow,
        clientId: "dummy",
        authorizationCodeExpiryDate: 0,
        redirectUri: "dummy",
        accessToken: "dummy",
        accessTokenExpiryDate: anHourFromNow,
        clientIpAddress: "192.0.0.1",
        subject: "user-id",
        persistentSessionId: "persisent-id",
      },
      { restricted: { device_information: { encoded: "txmaAuditHeader" } } }
    );
  });

  it("should successfully return 200 without txma-audit-encoded header", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          sessionId: { S: "session-123" },
          clientSessionId: { S: "gov-123" },
          expiryDate: { N: anHourFromNow.toString() },
          clientId: { S: "dummy" },
          authorizationCodeExpiryDate: { N: "0" },
          redirectUri: { S: "dummy" },
          accessToken: { S: "dummy" },
          accessTokenExpiryDate: { N: anHourFromNow.toString() },
          clientIpAddress: { S: "192.0.0.1" },
          subject: { S: "user-id" },
          persistentSessionId: { S: "persisent-id" },
        },
      ],
      Count: 1,
    });

    ddbMock.on(UpdateItemCommand).resolves({});

    const event = {
      body: JSON.stringify({}),
      headers: {
        ["session-id"]: "session-123",
      } as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result.statusCode).toEqual(200);
    expect(sendAuditEvent).toHaveBeenCalledWith(
      "ABANDONED",
      auditConfig,
      {
        sessionId: "session-123",
        clientSessionId: "gov-123",
        expiryDate: anHourFromNow,
        clientId: "dummy",
        authorizationCodeExpiryDate: 0,
        redirectUri: "dummy",
        accessToken: "dummy",
        accessTokenExpiryDate: anHourFromNow,
        clientIpAddress: "192.0.0.1",
        subject: "user-id",
        persistentSessionId: "persisent-id",
      },
      undefined
    );
  });

  it("should return a 400 when no session-id header", async () => {
    const event = {
      body: JSON.stringify({}),
      headers: {} as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result).toEqual({
      body: '{"message":"No session-id header present"}',
      statusCode: 400,
    });
  });

  it("should return a 400 when no session found", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [],
      Count: 0,
    });

    const event = {
      body: JSON.stringify({}),
      headers: {
        ["session-id"]: "session-123",
      } as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result).toEqual({
      body: '{"message":"Session not found"}',
      statusCode: 400,
    });
  });

  it("should return a 500 when error finding session", async () => {
    ddbMock.on(QueryCommand).rejects();

    const event = {
      body: JSON.stringify({}),
      headers: {
        ["session-id"]: "session-123",
      } as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result).toEqual({
      body: '{"message":"Internal server error"}',
      statusCode: 500,
    });
  });

  it("should return a 500 when error removing auth code from session", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          sessionId: { S: "session-123" },
          clientSessionId: { S: "gov-123" },
          expiryDate: { N: anHourFromNow.toString() },
          clientId: { S: "dummy" },
          authorizationCodeExpiryDate: { N: "0" },
          redirectUri: { S: "dummy" },
          accessToken: { S: "dummy" },
          accessTokenExpiryDate: { N: anHourFromNow.toString() },
          clientIpAddress: { S: "192.0.0.1" },
          subject: { S: "user-id" },
          persistentSessionId: { S: "persisent-id" },
        },
      ],
      Count: 1,
    });
    ddbMock.on(UpdateItemCommand).rejects();

    const event = {
      body: JSON.stringify({}),
      headers: {
        ["session-id"]: "session-123",
      } as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result).toEqual({
      body: '{"message":"Internal server error"}',
      statusCode: 500,
    });
  });

  it("should return a 500 when error sending audit event", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          sessionId: { S: "session-123" },
          clientSessionId: { S: "gov-123" },
          expiryDate: { N: anHourFromNow.toString() },
          clientId: { S: "dummy" },
          authorizationCodeExpiryDate: { N: "0" },
          redirectUri: { S: "dummy" },
          accessToken: { S: "dummy" },
          accessTokenExpiryDate: { N: anHourFromNow.toString() },
          clientIpAddress: { S: "192.0.0.1" },
          subject: { S: "user-id" },
          persistentSessionId: { S: "persisent-id" },
        },
      ],
      Count: 1,
    });
    ddbMock.on(UpdateItemCommand).resolves({});
    (sendAuditEvent as jest.Mock).mockRejectedValue(new Error("Audit failed"));

    const event = {
      body: JSON.stringify({}),
      headers: {
        ["session-id"]: "session-123",
      } as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result).toEqual({
      body: '{"message":"Internal server error"}',
      statusCode: 500,
    });
  });
});
