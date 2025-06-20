import * as mainModule from "../src/main";
import { handler } from "../src/handler";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { CriError } from "../../common/src/errors/cri-error";
import { LogHelper } from "../../logging/log-helper";
import { MetricsHelper } from "../../logging/metrics-helper";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockLogHelper } from "../../common/tests/logger";
import { mockMetricsHelper } from "../../common/tests/metrics-helper";
import { mockDynamoClient, mockEventBridgeClient, mockHelpers } from "./steps/mockConfig";

jest.mock("../../logging/log-helper");
jest.mock("../../logging/metrics-helper");
jest.mock("@aws-sdk/client-eventbridge");
jest.mock("@aws-sdk/client-dynamodb");

const main = jest.spyOn(mainModule, "main");

const mockEvent = {} as APIGatewayProxyEvent;
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

const message = "big error";

const internalServerError = "Internal server error";

describe("handler logic", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (LogHelper as unknown as jest.Mock).mockReturnValue(mockLogHelper);
    (MetricsHelper as unknown as jest.Mock).mockReturnValue(mockMetricsHelper);
    (EventBridgeClient as unknown as jest.Mock).mockReturnValue(mockEventBridgeClient);
    (DynamoDBClient as unknown as jest.Mock).mockReturnValue(mockDynamoClient);
  });

  it(`handles 400 CriErrors correctly`, async () => {
    main.mockImplementation(async () => {
      throw new CriError(400, message);
    });

    const res1 = await handler(mockEvent, mockContext);

    expect(main).toHaveBeenCalledWith(mockEvent, mockHelpers);

    expect(res1).toEqual(
      expect.objectContaining({
        statusCode: 400,
        body: JSON.stringify({ message }),
      })
    );
  });

  it("handles 500 CriErrors correctly", async () => {
    main.mockImplementation(async () => {
      throw new CriError(500, message);
    });

    const res2 = await handler(mockEvent, mockContext);

    expect(main).toHaveBeenCalledWith(mockEvent, mockHelpers);

    expect(res2).toEqual(
      expect.objectContaining({
        statusCode: 500,
        body: JSON.stringify({ message: internalServerError }),
      })
    );
  });

  it("handles non-CriErrors correctly", async () => {
    main.mockImplementation(async () => {
      throw new Error();
    });

    const res3 = await handler(mockEvent, mockContext);

    expect(main).toHaveBeenCalledWith(mockEvent, mockHelpers);

    expect(res3).toEqual(
      expect.objectContaining({
        statusCode: 500,
        body: JSON.stringify({ message: internalServerError }),
      })
    );
  });
});
