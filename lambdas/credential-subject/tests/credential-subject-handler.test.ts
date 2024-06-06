import { CredentialSubjectHandler } from "../src/credential-subject-handler";
import {
  UserInfoEvent,
  mockUserInfoEventItem,
  mockUserInfoEventItemWithBirthDates,
} from "../src/user-info-event";
import { Context } from "aws-lambda";

describe("credential-subject-handler.ts", () => {
  const expectedCredentialSubject = {
    name: [
      {
        nameParts: [
          {
            value: "Rishi",
            type: "GivenName",
          },
          {
            value: "Johnson",
            type: "FamilyName",
          },
        ],
      },
    ],
    socialSecurityRecord: [
      {
        personalNumber: "BB000001D",
      },
    ],
  };

  it("should input userInfoEvent and return credentialSubject", async () => {
    const handler = new CredentialSubjectHandler();
    const credentialSubject = await handler.handler(
      mockUserInfoEventItem as UserInfoEvent,
      {} as Context
    );
    expect(credentialSubject).toEqual(expectedCredentialSubject);
  });

  it("should input userInfoEvent with birthDates and return credentialSubject", async () => {
    const expectedCredentialSubjectWithBirthDates = {
      ...expectedCredentialSubject,
      birthDate: [{ value: "2000-01-01" }, { value: "1990-05-15" }],
    };
    const handler = new CredentialSubjectHandler();
    const credentialSubject = await handler.handler(
      mockUserInfoEventItemWithBirthDates as UserInfoEvent,
      {} as Context
    );

    expect(credentialSubject).toEqual(expectedCredentialSubjectWithBirthDates);
  });

  it("should return {} when passed %s", async () => {
    const handler = new CredentialSubjectHandler();

    const credentialSubject = await handler.handler(
      {} as UserInfoEvent,
      {} as Context
    );

    await expect(credentialSubject).toEqual({});
  });

  it.each([{ govJourneyId: mockUserInfoEventItem }])(
    "should return {} when passed %s",
    async (payload) => {
      const handler = new CredentialSubjectHandler();

      const credentialSubject = await handler.handler(
        payload as unknown as UserInfoEvent,
        {} as Context
      );

      expect(credentialSubject).toEqual({});
    }
  );
});
