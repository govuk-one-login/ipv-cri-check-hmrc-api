import { PersonIdentityItem, PersonIdentityNamePart } from "@govuk-one-login/cri-types";
import { UnixSecondsTimestamp } from "@govuk-one-login/cri-types/";
import { buildPdvInput } from "../../src/helpers/build-pdv-input";

const dateOfBirth = "1948-04-23";
const nino = "AA000003D";

const personIdentity: PersonIdentityItem = {
  sessionId: "12346",
  addresses: [],
  names: [
    {
      nameParts: [
        {
          type: "GivenName",
          value: "Jim",
        },
        {
          type: "FamilyName",
          value: "Ferguson",
        },
      ],
    },
  ],
  birthDates: [{ value: dateOfBirth }],
  expiryDate: (Date.now() / 1000 + 600) as UnixSecondsTimestamp,
  socialSecurityRecord: undefined,
};

describe("buildPdvInput", () => {
  it("should concat all provided FamilyNames", async () => {
    const firstName = "John";
    const lastName = "Alice Eve";

    // deep clone mock PI
    const manyFamilyNamesPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    manyFamilyNamesPersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: "John",
          },
          {
            type: "GivenName",
            value: "John",
          },
          {
            type: "FamilyName",
            value: "Alice",
          },
          {
            type: "FamilyName",
            value: "Eve",
          },
        ],
      },
    ];

    const result = buildPdvInput(manyFamilyNamesPersonIdentity, nino);

    expect(result).toStrictEqual({
      firstName,
      lastName,
      nino,
      dateOfBirth,
    });
  });

  it("should select only the first GivenName", async () => {
    const firstName = "TestFirstName";
    const lastName = "TestLastName";

    // deep clone mock PI
    const manyGivenNamesPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    manyGivenNamesPersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: firstName,
          },
          {
            type: "GivenName",
            value: "Bob",
          },
          {
            type: "FamilyName",
            value: lastName,
          },
        ],
      },
    ];

    const result = buildPdvInput(manyGivenNamesPersonIdentity, nino);

    expect(result).toStrictEqual({
      firstName,
      lastName,
      dateOfBirth,
      nino,
    });
  });

  it("should throw when GivenName is blank", async () => {
    // deep clone mock PI
    const blankFirstNamePersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    blankFirstNamePersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: "",
          },
          {
            type: "FamilyName",
            value: "TestLastName",
          },
        ],
      },
    ];

    expect(() => buildPdvInput(blankFirstNamePersonIdentity, nino)).toThrow(new Error("First Name is blank"));
  });

  it("should throw when FamilyName is blank", async () => {
    // deep clone mock PI
    const blankGivenNamePersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    blankGivenNamePersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
            value: "TestFirstName",
          },
          {
            type: "GivenName",
            value: "",
          },
        ],
      },
    ];

    expect(() => buildPdvInput(blankGivenNamePersonIdentity, nino)).toThrow(new Error("Last Name is blank"));
  });

  it("should throw when no value for name part is provided", async () => {
    // deep clone mock PI
    const blankNamePartPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));

    blankNamePartPersonIdentity.names = [
      {
        nameParts: [
          {
            type: "GivenName",
          } as PersonIdentityNamePart,
          {
            type: "FamilyName",
            value: "test",
          },
        ],
      },
    ];

    expect(() => buildPdvInput(blankNamePartPersonIdentity, nino)).toThrow(new Error("First Name is blank"));
  });

  it("should throw if names is undefined", async () => {
    const blankNamePartPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));
    blankNamePartPersonIdentity.names = undefined;

    expect(() => buildPdvInput(blankNamePartPersonIdentity, nino)).toThrow(new Error("Names or BirthDates is blank"));
  });

    it("should throw if birthDates is undefined", async () => {
    const blankNamePartPersonIdentity: PersonIdentityItem = JSON.parse(JSON.stringify(personIdentity));
    blankNamePartPersonIdentity.birthDates = undefined;

    expect(() => buildPdvInput(blankNamePartPersonIdentity, nino)).toThrow(new Error("Names or BirthDates is blank"));
  });
});
