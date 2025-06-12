export interface PersonIdentity {
  names: any;
  birthDates: { L: [{ M: { value: { S: string } } }] };
}

interface NamePart {
  M: {
    type?: {
      S?: string;
    };
    value?: {
      S?: string;
    };
  };
}

interface NameParts {
  L: NamePart[];
}

interface Person {
  M: {
    nameParts: NameParts;
  };
}

export interface Names {
  L: Person[];
}

export function extractName(name: Names): {
  firstName: string;
  lastName: string;
} {
  let firstName = "";
  let surname = "";
  for (const person of name.L) {
    for (const namePart of person.M.nameParts.L) {
      const type = namePart.M.type?.S;
      const value = namePart.M.value?.S;
      if (type === "FamilyName") {
        surname = (surname + " " + value).trim();
      } else if (type === "GivenName" && firstName === "" && value) {
        firstName = value.trim();
      }
    }
  }
  return {
    firstName: firstName.trim(),
    lastName: surname.trim(),
  };
}
