jest.mock("../../common/src/util/logger", () => ({
  logger: mockLogger,
}));
jest.mock("../src/helpers/add-auth-code-to-session");
jest.mock("../src/helpers/audit");
jest.mock("../src/helpers/function-config");
jest.mock("../src/helpers/nino");
jest.mock("../src/helpers/retrieve-attempts");
jest.mock("../src/helpers/retrieve-person-identity");
jest.mock("../src/helpers/retrieve-session");
jest.mock("../src/hmrc-apis/pdv");
jest.mock("../src/hmrc-apis/otg");

import { mockDynamoClient } from "./mocks/mockDynamoClient";
import { mockNino, mockOtgToken, mockPdvRes, mockPersonIdentity, mockSession, mockSessionId } from "./mocks/mockData";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { mockDeviceInformationHeader, mockFunctionConfig, mockHmrcConfig } from "./mocks/mockConfig";
import { mockLogger } from "../../common/tests/logger";

import { handler } from "../src/handler";
import { retrieveSession } from "../src/helpers/retrieve-session";
import { NinoCheckFunctionConfig } from "../src/helpers/function-config";
import { getHmrcConfig, handlePdvResponse, saveAttempt, saveTxn } from "../src/helpers/nino";
import { retrieveAttempts } from "../src/helpers/retrieve-attempts";
import { retrievePersonIdentity } from "../src/helpers/retrieve-person-identity";
import { sendRequestSentEvent, sendResponseReceivedEvent } from "../src/helpers/audit";
import { matchUserDetailsWithPdv } from "../src/hmrc-apis/pdv";
import { addAuthCodeToSession } from "../src/helpers/add-auth-code-to-session";
import { getTokenFromOtg } from "../src/hmrc-apis/otg";
import { buildPdvInput } from "../src/helpers/build-pdv-input";

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
  body: expect.stringContaining('"message":'),
};

const handlerInput: Parameters<typeof handler> = [
  {
    headers: {
      "session-id": mockSessionId,
      "txma-audit-encoded": mockDeviceInformationHeader,
    },
    body: JSON.stringify({
      nino: mockNino,
    }),
  } as unknown as APIGatewayProxyEvent,
  mockContext,
];

(NinoCheckFunctionConfig as unknown as jest.Mock).mockReturnValue(mockFunctionConfig);
(retrieveSession as unknown as jest.Mock).mockResolvedValue(mockSession);
(getHmrcConfig as unknown as jest.Mock).mockResolvedValue(mockHmrcConfig);
(retrieveAttempts as unknown as jest.Mock).mockResolvedValue([]);
(retrievePersonIdentity as unknown as jest.Mock).mockResolvedValue(mockPersonIdentity);
(getTokenFromOtg as unknown as jest.Mock).mockResolvedValue(mockOtgToken);
(matchUserDetailsWithPdv as unknown as jest.Mock).mockResolvedValue(mockPdvRes);
(handlePdvResponse as unknown as jest.Mock).mockResolvedValue(true);

describe("nino-check handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("executes successfully with a valid input", async () => {
    const response = await handler(...handlerInput);

    expect(response).toStrictEqual({
      statusCode: 200,
      body: JSON.stringify({ requestRetry: false }),
    });

    expect(NinoCheckFunctionConfig).toHaveBeenCalledWith({ deviceInformationHeader: mockDeviceInformationHeader });
    expect(mockLogger.appendKeys).toHaveBeenCalledWith({
      govuk_signin_journey_id: mockSession.clientSessionId,
    });
    expect(sendRequestSentEvent).toHaveBeenCalledWith(
      mockFunctionConfig.audit,
      mockSession,
      mockPersonIdentity,
      mockNino
    );
    expect(matchUserDetailsWithPdv).toHaveBeenCalledWith(
      mockHmrcConfig.pdv,
      mockOtgToken,
      buildPdvInput(mockPersonIdentity, mockNino)
    );
    expect(saveTxn).toHaveBeenCalledWith(
      mockDynamoClient,
      mockFunctionConfig.tableNames.sessionTable,
      mockSessionId,
      mockPdvRes.txn
    );
    expect(sendResponseReceivedEvent).toHaveBeenCalledWith(mockFunctionConfig.audit, mockSession, mockPdvRes.txn);
    expect(saveAttempt).toHaveBeenCalledWith(
      mockDynamoClient,
      mockFunctionConfig.tableNames.attemptTable,
      mockSession,
      mockPdvRes
    );
    expect(addAuthCodeToSession).toHaveBeenCalledWith(
      mockDynamoClient,
      mockFunctionConfig.tableNames,
      mockSessionId,
      mockNino
    );
  });
});
