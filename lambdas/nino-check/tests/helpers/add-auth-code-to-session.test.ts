import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { addAuthCodeToSession } from "../../src/helpers/add-auth-code-to-session";
import { mockSaveRes, mockTableNames } from "../mocks/mockConfig";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { mockNino, mockSessionId } from "../mocks/mockData";
jest.mock("../../../common/src/util/logger");

const mockDynamoClient = mockClient(DynamoDBClient);
mockDynamoClient.on(PutItemCommand).resolves(mockSaveRes);
mockDynamoClient.on(UpdateItemCommand).resolves(mockSaveRes);

describe("NINo Check function issueAuthorizationCode()", () => {
  it(`saves entities to Dynamo as expected`, async () => {
    await addAuthCodeToSession(mockDynamoClient as unknown as DynamoDBClient, mockTableNames, mockSessionId, mockNino);

    expect(mockDynamoClient).toHaveReceivedCommandWith(UpdateItemCommand, {
      TableName: mockTableNames.sessionTable,
      Key: { sessionId: { S: mockSessionId } },
      UpdateExpression: `SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry`,
      ExpressionAttributeValues: {
        ":authCode": {
          S: expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
        },
        ":authCodeExpiry": { N: expect.stringMatching(/^\d+$/) },
      },
    });

    expect(mockDynamoClient).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: mockTableNames.ninoUserTable,
      Item: {
        sessionId: {
          S: mockSessionId,
        },
        nino: {
          S: mockNino,
        },
      },
    });
  });
});
