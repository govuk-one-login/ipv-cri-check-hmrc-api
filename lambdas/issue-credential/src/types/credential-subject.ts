export interface SocialSecurityRecord {
  personalNumber: string;
}

export interface NamePart {
  type: string;
  value: string;
}

export interface Name {
  nameParts: NamePart[];
}

export interface BirthDate {
  value: string;
}

export interface CredentialSubject {
  name?: Name[];
  birthDate?: BirthDate[];
  socialSecurityRecord?: SocialSecurityRecord[];
}
