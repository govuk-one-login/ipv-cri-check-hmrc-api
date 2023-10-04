type SocialSecurityRecord = {
  personalNumber: string;
};

type Name = {
  nameParts: Array<NamePart>;
};

export type NamePart = {
  type: string;
  value: string;
};

export type CredentialSubject = {
  name: Array<Name>;
  socialSecurityRecord: Array<SocialSecurityRecord>;
};

export class CredentialSubjectBuilder {
  private personalNumber!: string;
  private name: Array<NamePart> = [];

  addName(type: string, value: string): CredentialSubjectBuilder {
    this.name.push({ type, value } as NamePart);

    return this;
  }
  addNames(names: Array<NamePart>) {
    this.name = names;
    return this;
  }
  setPersonalNumber(personalNumber: string): CredentialSubjectBuilder {
    this.personalNumber = personalNumber;
    return this;
  }

  build(): CredentialSubject {
    const credentialSubject = {} as CredentialSubject;
    if (this.personalNumber) {
      credentialSubject.socialSecurityRecord = [
        {
          personalNumber: this.personalNumber as string,
        } as SocialSecurityRecord,
      ];
    }
    if (this.name.length != 0) {
      credentialSubject.name = [{ nameParts: this.name } as Name];
    }
    return credentialSubject;
  }
}
