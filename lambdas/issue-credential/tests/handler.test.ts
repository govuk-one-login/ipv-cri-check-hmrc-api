import { mockLogger } from "../../common/tests/logger";
import { mockDynamoClient } from "../../common/tests/mocks/mockDynamoClient";

jest.mock("../../common/src/util/logger", () => ({
  logger: mockLogger,
}));
jest.mock("../../common/src/config/base-function-config");
jest.mock("../../common/src/database/get-attempts");
jest.mock("../../common/src/database/get-record-by-session-id");
jest.mock("../src/helpers/retrieve-session-by-access-token");
jest.mock("../src/helpers/retrieve-nino-user");
jest.mock("../../common/src/util/metrics", () => ({
  metrics: {
    logMetrics: jest.fn(() => () => {}),
  },
}));
jest.mock("../src/config/function-config");
jest.mock("../src/vc/vc-builder");
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-123"),
}));
jest.mock("../src/vc/contraIndicator");
jest.mock("../../common/src/util/date-time", () => ({
  toEpochSecondsFromNow: jest.fn(() => 1234567890),
}));
jest.mock("../../common/src/util/dynamo", () => ({
  dynamoDBClient: mockDynamoClient,
}));
import { mockFunctionConfig } from "../../common/tests/mocks/mockConfig";
import { BaseFunctionConfig } from "../../common/src/config/base-function-config";
import { IssueCredFunctionConfig } from "../src/config/function-config";
import * as VcConfig from "../src/config/function-config";
(BaseFunctionConfig as unknown as jest.Mock).mockReturnValue(mockFunctionConfig);
(IssueCredFunctionConfig as unknown as jest.Mock).mockImplementation(() => ({
  ...mockFunctionConfig,
  credentialIssuerEnv: {
    maxJwtTtl: 1,
    jwtTtlUnit: "seconds",
    commonStackName: "common-cri-api",
  },
}));

import {
  mockAccessToken,
  mockNinoUser,
  mockPersonIdentity,
  mockSession,
  mockSessionId,
} from "../../common/tests/mocks/mockData";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { handler } from "../src/handler";
import { retrieveSessionIdByAccessToken } from "../src/helpers/retrieve-session-by-access-token";
import { getAttempts } from "../../common/src/database/get-attempts";
import { retrieveNinoUser } from "../src/helpers/retrieve-nino-user";
import { getRecordBySessionId, getSessionBySessionId } from "../../common/src/database/get-record-by-session-id";
import { buildVerifiableCredential } from "../src/vc/vc-builder";
import { getHmrcContraIndicators } from "../src/vc/contraIndicator";

(buildVerifiableCredential as unknown as jest.Mock).mockReturnValue({ mockVc: "credential" });
(getHmrcContraIndicators as unknown as jest.Mock).mockReturnValue([]);

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
(getAttempts as unknown as jest.Mock).mockResolvedValue({ count: 0, items: [] });
(getSessionBySessionId as unknown as jest.Mock).mockResolvedValueOnce(mockSession);
(getRecordBySessionId as unknown as jest.Mock).mockResolvedValueOnce(mockPersonIdentity);
(retrieveNinoUser as unknown as jest.Mock).mockResolvedValue(mockNinoUser);

describe("issue-credential handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("executes successfully with a valid input", async () => {
    const spyVcConfig = jest.spyOn(VcConfig, "getVcConfig").mockResolvedValueOnce({
      contraIndicator: {
        errorMapping: ["mapping1", "mapping2"],
        reasonsMapping: [],
      },
      kms: { signingKeyId: "some-key-id" },
    });

    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: expect.any(String),
    });
    expect(spyVcConfig).toHaveBeenCalledWith("common-cri-api");
    expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: mockSession.clientSessionId });
    expect(getAttempts).toHaveBeenCalledWith(
      mockFunctionConfig.tableNames.attemptTable,
      mockDynamoClient,
      mockSession.sessionId
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
    expect(getAttempts).not.toHaveBeenCalled();
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
