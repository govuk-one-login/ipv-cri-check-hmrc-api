import { isRecordExpired } from "../../../src/database/util/is-record-expired";
import { UnixSecondsTimestamp } from "../../../src/types/brands";

describe("isRecordExpired()", () => {
  it("returns true for times in the past", () => {
    expect(isRecordExpired({ expiryDate: (Date.now() / 1000 - 30) as UnixSecondsTimestamp })).toStrictEqual(true);
  });

  it(`returns false for times in the future`, () => {
    expect(isRecordExpired({ expiryDate: (Date.now() / 1000 + 30) as UnixSecondsTimestamp })).toStrictEqual(false);
  });

  it(`returns true for negative times`, () => {
    expect(isRecordExpired({ expiryDate: -300 as UnixSecondsTimestamp })).toStrictEqual(true);
  });

  it(`checks records with ttl instead of expiryDate properly`, () => {
    expect(isRecordExpired({ ttl: (Date.now() / 1000 + 30) as UnixSecondsTimestamp })).toStrictEqual(false);
    expect(isRecordExpired({ ttl: -300 as UnixSecondsTimestamp })).toStrictEqual(true);
  });

  it(`throws for records with no expiry date`, () => {
    expect(() => isRecordExpired({ ttl: 0 as UnixSecondsTimestamp })).toThrow(Error);
    // @ts-expect-error we have deliberately passed something invalid in here
    expect(() => isRecordExpired({ expiryDate: null })).toThrow(Error);
    // @ts-expect-error we have deliberately passed something invalid in here
    expect(() => isRecordExpired({})).toThrow(Error);
  });
});
