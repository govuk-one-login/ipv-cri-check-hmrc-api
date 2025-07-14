import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { AbandonHandler } from "../src/abandon-handler";
import { APIGatewayProxyEvent, APIGatewayProxyEventHeaders, Context } from "aws-lambda";

describe("abandon-handler", () => {
  const ddbMock = mockClient(DynamoDBClient);
  const ebMock = mockClient(EventBridgeClient);

  const now = Math.round(Date.now() / 1000);
  const anHourFromNow = now + 60 * 60;

  beforeEach(() => {
    ddbMock.reset();
    ebMock.reset();
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

    ebMock.on(PutEventsCommand).resolves({
      Entries: [],
      FailedEntryCount: 0,
    });

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
    const receivedCommand = ebMock.calls()[0].args[0] as PutEventsCommand;
    expect(receivedCommand.input).toEqual({
      Entries: [
        {
          Detail:
            '{"auditPrefix":"IPV_HMRC_RECORD_CHECK_CRI","user":{"govuk_signin_journey_id":"gov-123","ip_address":"192.0.0.1","session_id":"session-123","user_id":"user-id","persistent_session_id":"persisent-id"},"deviceInformation":"txmaAuditHeader","issuer":"issuer"}',
          DetailType: "ABANDONED",
          EventBusName: "bus-name",
          Source: "bus-source",
        },
      ],
    });
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

    ebMock.on(PutEventsCommand).resolves({
      Entries: [],
      FailedEntryCount: 0,
    });

    const event = {
      body: JSON.stringify({}),
      headers: {
        ["session-id"]: "session-123",
      } as APIGatewayProxyEventHeaders,
    } as unknown as APIGatewayProxyEvent;

    const abandonHandler = new AbandonHandler();
    const result = await abandonHandler.handler(event, {} as Context);

    expect(result.statusCode).toEqual(200);
    const receivedCommand = ebMock.calls()[0].args[0] as PutEventsCommand;
    expect(receivedCommand.input).toEqual({
      Entries: [
        {
          Detail:
            '{"auditPrefix":"IPV_HMRC_RECORD_CHECK_CRI","user":{"govuk_signin_journey_id":"gov-123","ip_address":"192.0.0.1","session_id":"session-123","user_id":"user-id","persistent_session_id":"persisent-id"},"issuer":"issuer"}',
          DetailType: "ABANDONED",
          EventBusName: "bus-name",
          Source: "bus-source",
        },
      ],
    });
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
    ebMock.on(PutEventsCommand).rejects();

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
