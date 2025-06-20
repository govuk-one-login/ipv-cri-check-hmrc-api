import { LogHelper } from "../log-helper";
import { Context } from "aws-lambda";

jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn(() => ({
    appendKeys: jest.fn(),
    addContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

export const context: Context = {
  awsRequestId: "",
  callbackWaitsForEmptyEventLoop: false,
  functionName: "TestSource",
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

const govJourneyId = "123456";

describe("log-helper", () => {
  let logHelper: LogHelper;

  beforeEach(() => {
    logHelper = new LogHelper(context, govJourneyId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should log entry with source and govJourneyId", () => {
    logHelper.logEntry();

    expect(logHelper.logger.appendKeys).toHaveBeenCalledWith({
      govuk_signin_journey_id: govJourneyId,
    });
    expect(logHelper.logger.info).toHaveBeenCalledWith(
      `${context.functionName} invoked with government journey id: ${govJourneyId}`
    );
  });

  it("should log errors with message JourneyId", () => {
    const errorMessage = "Test error message";

    logHelper.logError(errorMessage);

    expect(logHelper.logger.error).toHaveBeenCalledWith({
      message: `Error in ${context.functionName}: ${errorMessage}`,
      govuk_signin_journey_id: govJourneyId,
    });
  });
});
