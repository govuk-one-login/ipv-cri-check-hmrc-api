interface NamePart {
  M: {
    type: {
      S: string;
    };
    value: {
      S: string;
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

interface Names {
  L: Person[];
}
