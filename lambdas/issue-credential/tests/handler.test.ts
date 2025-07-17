jest.mock("../../common/src/util/logger", () => ({
  logger: mockLogger,
}));
jest.mock("../../common/src/config/base-function-config");
jest.mock("../../common/src/database/count-attempts");
jest.mock("../../common/src/database/get-record-by-session-id");
jest.mock("../src/helpers/retrieve-session-by-access-token");
jest.mock("../src/helpers/retrieve-nino-user");
jest.mock("../../common/src/util/metrics");

import { mockFunctionConfig } from "../../common/tests/mocks/mockConfig";
import { BaseFunctionConfig } from "../../common/src/config/base-function-config";
(BaseFunctionConfig as unknown as jest.Mock).mockReturnValue(mockFunctionConfig);

import { mockDynamoClient } from "../../common/tests/mocks/mockDynamoClient";
import {
  mockAccessToken,
  mockNinoUser,
  mockPersonIdentity,
  mockSession,
  mockSessionId,
} from "../../common/tests/mocks/mockData";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { mockLogger } from "../../common/tests/logger";
import { handler } from "../src/handler";
import { retrieveSessionIdByAccessToken } from "../src/helpers/retrieve-session-by-access-token";
import { countAttempts } from "../../common/src/database/count-attempts";
import { retrieveNinoUser } from "../src/helpers/retrieve-nino-user";
import { getRecordBySessionId } from "../../common/src/database/get-record-by-session-id";

const mockContext: Context = {
  awsRequestId: "",
  callbackWaitsForEmptyEventLoop: false,
  functionName: "",
  functionVersion: "",
  invokedFunctionArn: "",
  logGroupName: "",
  logStreamName: "",
  memoryLimitInMB: "",
  done(): void {},
  fail(): void {},
  getRemainingTimeInMillis(): number {
    return 0;
  },
  succeed(): void {},
};

const internalServerError = {
  statusCode: 500,
  body: JSON.stringify({ message: "Internal server error" }),
};

const badRequest = {
  statusCode: 400,
  body: expect.any(String),
};

const handlerInput: Parameters<typeof handler> = [
  {
    headers: {
      Authorization: `Bearer ${mockAccessToken}`,
    },
  } as unknown as APIGatewayProxyEvent,
  mockContext,
];

(retrieveSessionIdByAccessToken as unknown as jest.Mock).mockResolvedValue(mockSessionId);
(countAttempts as unknown as jest.Mock).mockResolvedValue(0);
(getRecordBySessionId as unknown as jest.Mock).mockResolvedValueOnce(mockSession);
(getRecordBySessionId as unknown as jest.Mock).mockResolvedValueOnce(mockPersonIdentity);
(retrieveNinoUser as unknown as jest.Mock).mockResolvedValue(mockNinoUser);

describe("issue-credential handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("executes successfully with a valid input", async () => {
    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ failedAttemptCount: 0, personIdentity: mockPersonIdentity, ninoUser: mockNinoUser }),
    });

    expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: mockSession.clientSessionId });
    expect(countAttempts).toHaveBeenCalledWith(
      mockFunctionConfig.tableNames.attemptTable,
      mockDynamoClient,
      mockSession.sessionId,
      "FAIL"
    );
  });

  it("handles application errors correctly", async () => {
    (retrieveSessionIdByAccessToken as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error("nooooooo!!!");
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual(internalServerError);

    expect(retrieveSessionIdByAccessToken).toHaveBeenCalledWith(
      mockFunctionConfig.tableNames.sessionTable,
      mockDynamoClient,
      `Bearer ${mockAccessToken}`
    );
    expect(countAttempts).not.toHaveBeenCalled();
  });

  it("handles a missing or malformed access token", async () => {
    const response1 = await handler({ headers: {} } as unknown as APIGatewayProxyEvent, mockContext);
    expect(response1).toStrictEqual(badRequest);

    const response2 = await handler(
      { headers: { Authorization: "Bearer" } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response2).toStrictEqual(badRequest);

    const response3 = await handler(
      { headers: { Authorization: "gimme the access" } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response3).toStrictEqual(badRequest);

    const response4 = await handler(
      { headers: { Authorization: "Bearer billybob " } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response4).toStrictEqual(badRequest);

    const response5 = await handler(
      { headers: { Authorization: "Bearer      billybob" } } as unknown as APIGatewayProxyEvent,
      mockContext
    );
    expect(response5).toStrictEqual(badRequest);

    expect(retrieveSessionIdByAccessToken).not.toHaveBeenCalled();
  });
});
