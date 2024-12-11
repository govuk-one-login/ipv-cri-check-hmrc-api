import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";

export class LogHelper {
  constructor(
    context: Context,
    public logger = new Logger()
  ) {
    logger.addContext(context);
  }

  logEntry(source: string, govJourneyId: string) {
    this.logger.appendKeys({
      govuk_signin_journey_id: govJourneyId,
    });
    this.logger.info(
      `${source} invoked with government journey id: ${govJourneyId}`
    );
  }

  logError(source: string, govJourneyId: string, message: string) {
    this.logger.error({
      message: `Error in ${source}: ${message}`,
      govuk_signin_journey_id: govJourneyId,
    });
  }
}
