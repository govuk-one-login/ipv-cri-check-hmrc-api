import { PersonIdentityItem } from "../../../common/src/database/types/person-identity";
import { PdvApiInput } from "../../../common/src/hmrc-apis/types/pdv";

export function buildPdvInput(personIdentity: PersonIdentityItem, nino: string): PdvApiInput {
  let firstName = "";
  let lastName = "";

  for (const name of personIdentity.names) {
    for (const namePart of name.nameParts) {
      const { type, value } = namePart;

      switch (type) {
        case "FamilyName": {
          lastName = [lastName, value].join(" ").trim();
          break;
        }
        case "GivenName": {
          if (firstName === "" && value) {
            firstName = value.trim();
          }
          break;
        }
      }
    }
  }
  if (!firstName) {
    throw new Error("First Name is blank");
  }
  if (!lastName) {
    throw new Error("Last Name is blank");
  }

  return {
    firstName,
    lastName,
    dateOfBirth: personIdentity.birthDates[0].value,
    nino,
  };
}
