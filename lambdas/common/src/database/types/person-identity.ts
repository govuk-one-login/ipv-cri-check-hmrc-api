// Source: https://github.com/govuk-one-login/ipv-cri-common-lambdas/blob/main/lambdas/src/types/person-identity-item.ts

import { UnixSecondsTimestamp } from "../../types/brands";

export interface PersonIdentitySocialSecurityRecord {
  personalNumber: string;
}

export interface PersonIdentityNamePart {
  type: string;
  value: string;
}

export interface PersonIdentityName {
  nameParts: PersonIdentityNamePart[];
}

export interface PersonIdentityAddress {
  uprn: number;
  organisationName: string;
  departmentName: string;
  subBuildingName: string;
  buildingNumber: string;
  buildingName: string;
  dependentStreetName: string;
  streetName: string;
  doubleDependentAddressLocality: string;
  dependentAddressLocality: string;
  addressLocality: string;
  postalCode: string;
  addressCountry: string;
  validFrom: string;
  validUntil: string;
}

export interface PersonIdentityDateOfBirth {
  value: string;
}

export interface PersonIdentityItem {
  sessionId: string;
  addresses: PersonIdentityAddress[];
  names: PersonIdentityName[];
  birthDates: PersonIdentityDateOfBirth[];
  expiryDate: UnixSecondsTimestamp;
  socialSecurityRecord?: PersonIdentitySocialSecurityRecord[];
}
