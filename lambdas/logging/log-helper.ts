import { Logger } from "@aws-lambda-powertools/logger";

export class LogHelper {
  constructor(public logger = new Logger()) {}
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

export const { logEntry, logError } = new LogHelper();
