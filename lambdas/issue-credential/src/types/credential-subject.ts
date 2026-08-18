import type {
  BirthDateClass,
  IdentityCheckSubjectClass,
  NameClass,
  SocialSecurityRecordDetailsClass,
} from "@govuk-one-login/data-vocab/credentials";

type Satisfies<Constraint, Target extends Constraint> = Target;

export type SocialSecurityRecord = Satisfies<
  SocialSecurityRecordDetailsClass,
  {
    personalNumber: string;
  }
>;

export type CredentialSubject = Satisfies<
  IdentityCheckSubjectClass,
  {
    name?: NameClass[];
    birthDate?: BirthDateClass[];
    socialSecurityRecord?: SocialSecurityRecord[];
  }
>;