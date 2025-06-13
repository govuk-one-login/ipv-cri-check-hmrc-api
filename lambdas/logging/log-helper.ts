import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";
import { ISO8601DateString } from "../common/src/types/brands";

export class LogHelper {
  constructor(
    public readonly context: Context,
    public readonly govJourneyId: string,
    public readonly logger = new Logger(),
    public readonly handlerStartTime = new Date().toISOString() as ISO8601DateString
  ) {
    logger.addContext(context);
    logger.appendKeys({
      govuk_signin_journey_id: this.govJourneyId,
    });
  }

  logEntry(source?: string) {
    this.logger.info(
      `${
        source ?? this.context.functionName
      } invoked with government journey id: ${this.govJourneyId}`
    );
  }

  logError(message: string, source?: string) {
    this.logger.error({
      message: `Error in ${source ?? this.context.functionName}: ${message}`,
    });
  }
}
