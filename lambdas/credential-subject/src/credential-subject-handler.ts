import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { UserInfoEvent } from "./user-info-event";
import {
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
    try {
      return credentialSubjectBuilder
        .setPersonalNumber(event?.nino)
        .addNames(this.convertToCredentialSubjectNames(event))
        .build();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error in CredentialSubjectHandler: ${message}`);
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
