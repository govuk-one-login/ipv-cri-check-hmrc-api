import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { UserInfoEvent } from "./user-info-event";
import {
  BirthDate,
  CredentialSubject,
  CredentialSubjectBuilder,
  NamePart,
} from "./credential-subject-builder";

const logger = new Logger();
const credentialSubjectBuilder = new CredentialSubjectBuilder();
export class CredentialSubjectHandler implements LambdaInterface {
  public async handler(
    event: UserInfoEvent,
    _context: unknown
  ): Promise<CredentialSubject> {
    logger.info(
      `Lambda invoked with government journey id: ${event.govJourneyId}`
    );
    try {
      return credentialSubjectBuilder
        .setPersonalNumber(event?.nino)
        .addNames(this.convertToCredentialSubjectNames(event))
        .setBirthDate(
          event?.userInfoEvent?.Items[0]?.birthDates?.L?.map(
            (birthDate) => ({ value: birthDate.M.value.S }) as BirthDate
          )
        )
        .build();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({
        message: `Error in CredentialSubjectHandler: ${message}`,
        govJourneyId: event.govJourneyId,
      });
      throw error;
    }
  }

  private convertToCredentialSubjectNames = (
    event: UserInfoEvent
  ): Array<NamePart> => {
    return event?.userInfoEvent?.Items[0]?.names?.L[0]?.M?.nameParts?.L?.map(
      (part) => ({ type: part.M.type.S, value: part.M.value.S }) as NamePart
    );
  };
}

const handlerClass = new CredentialSubjectHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
