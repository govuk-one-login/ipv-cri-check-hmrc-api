type SocialSecurityRecord = {
  personalNumber: string;
};

type Name = {
  nameParts: Array<NamePart>;
};

export type BirthDate = {
  value: string;
};

export type NamePart = {
  type: string;
  value: string;
};

export type CredentialSubject = {
  birthDate: BirthDate[];
  name: Array<Name>;
  socialSecurityRecord: Array<SocialSecurityRecord>;
};

export class CredentialSubjectBuilder {
  private personalNumber!: string;
  private name: Array<NamePart> = [];
  private birthDate: Array<BirthDate> = [];

  addName(type: string, value: string): this {
    this.name.push({ type, value } as NamePart);

    return this;
  }
  addNames(names: Array<NamePart>) {
    this.name = names;
    return this;
  }
  setPersonalNumber(personalNumber: string): this {
    this.personalNumber = personalNumber;

    return this;
  }

  setBirthDate(birthDates: Array<BirthDate>): this {
    this.birthDate = birthDates;

    return this;
  }

  build(): CredentialSubject {
    const credentialSubject = {} as CredentialSubject;
    if (this?.personalNumber) {
      credentialSubject.socialSecurityRecord = [
        {
          personalNumber: this.personalNumber as string,
        } as SocialSecurityRecord,
      ];
    }
    if (this?.birthDate?.length) {
      credentialSubject.birthDate = this.birthDate;
    }
    if (this?.name?.length) {
      credentialSubject.name = [{ nameParts: this?.name } as Name];
    }
    return credentialSubject;
  }
}
