import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";
import { ISO8601DateString } from "../common/src/types/brands";

export class LogHelper {
  constructor(
    public readonly context: Context,
    public govJourneyId?: string,
    public readonly logger = new Logger(),
    public readonly handlerStartTime = new Date().toISOString() as ISO8601DateString
  ) {
    logger.addContext(context);
    if (govJourneyId) {
      logger.appendKeys({
        govuk_signin_journey_id: this.govJourneyId,
      });
    }
  }

  logEntry(govJourneyId?: string) {
    this.logger.info(
      `${this.context.functionName} invoked with government journey id: ${govJourneyId ?? this.govJourneyId}`
    );
    if (govJourneyId) {
      this.govJourneyId = govJourneyId;
      this.logger.appendKeys({
        govuk_signin_journey_id: this.govJourneyId,
      });
    }
  }

  logError(message: string, source?: string) {
    this.logger.error({
      message: `Error in ${source ?? this.context.functionName}: ${message}`,
      govuk_signin_journey_id: this.govJourneyId,
    });
  }
}
