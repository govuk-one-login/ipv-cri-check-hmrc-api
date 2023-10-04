import { CredentialSubjectHandler } from "../src/credential-subject-handler";
import { UserInfoEvent, mockUserInfoEventItem } from "../src/user-info-event";

describe("credential-subject-handler.ts", () => {
  it("should input userInfoEvent and return credentialSubject", async () => {
    const handler = new CredentialSubjectHandler();
    const credentialSubject = await handler.handler(
      mockUserInfoEventItem as UserInfoEvent,
      {} as unknown
    );
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
    expect(credentialSubject).toEqual(expectedCredentialSubject);
  });

  it("should return undefined when passed in an emtpy object", async () => {
    const handler = new CredentialSubjectHandler();
    const invalidEvent = {} as UserInfoEvent;

    await expect(async () => {
      await handler.handler(invalidEvent, {} as unknown);
    }).rejects.toThrowError(
      "Cannot read properties of undefined (reading 'Items')"
    );
  });
});
