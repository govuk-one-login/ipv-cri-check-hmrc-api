import { CredentialSubjectBuilder } from "../src/credential-subject-builder";

describe("CredentialSubjectBuilder", () => {
  it("should create a CredentialSubject with the specified personalNumber and name", () => {
    const credentialSubject = new CredentialSubjectBuilder()
      .setPersonalNumber("SG1234567")
      .addName("GivenName", "John")
      .addName("FamilyName", "Doe")
      .build();

    expect(credentialSubject.socialSecurityRecord).toHaveLength(1);
    expect(credentialSubject.socialSecurityRecord[0].personalNumber).toBe(
      "SG1234567"
    );
    expect(credentialSubject.name).toHaveLength(1);
    expect(credentialSubject.name[0].nameParts).toEqual([
      { type: "GivenName", value: "John" },
      { type: "FamilyName", value: "Doe" },
    ]);
  });

  it("should create a CredentialSubject with multiple name parts", () => {
    const nameParts = [
      { type: "GivenName", value: "Alice" },
      { type: "FamilyName", value: "Smith" },
      { type: "GivenName", value: "John" },
      { type: "FamilyName", value: "Smith" },
    ];

    const credentialSubject = new CredentialSubjectBuilder()
      .setPersonalNumber("SG1234567")
      .addNames(nameParts)
      .build();

    expect(credentialSubject.socialSecurityRecord).toHaveLength(1);
    expect(credentialSubject.socialSecurityRecord[0].personalNumber).toBe(
      "SG1234567"
    );
    expect(credentialSubject.name).toHaveLength(1);
    expect(credentialSubject.name[0].nameParts).toEqual(nameParts);
  });

  it("should create a CredentialSubject with name, birthDate", () => {
    const nameParts = [
      { type: "GivenName", value: "John" },
      { type: "FamilyName", value: "Doe" },
    ];

    const birthDates = [{ value: "15-01-1990" }, { value: "20-05-2000" }];

    const credentialSubject = new CredentialSubjectBuilder()
      .addNames(nameParts)
      .setBirthDate(birthDates)
      .build();

    expect(credentialSubject.name).toHaveLength(1);
    expect(credentialSubject.name[0].nameParts).toEqual(nameParts);

    expect(credentialSubject.birthDate).toHaveLength(2);
    expect(credentialSubject.birthDate).toEqual(birthDates);
  });

  it("should return empty object", () => {
    expect(new CredentialSubjectBuilder().build()).toEqual({});
  });
});
