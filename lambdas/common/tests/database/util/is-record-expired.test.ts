import { isRecordExpired } from "../../../src/database/util/is-record-expired";

describe("isRecordExpired()", () => {
  it("returns true for times in the past", () => {
    expect(
      isRecordExpired({ expiryDate: Date.now() / 1000 - 30 })
    ).toStrictEqual(true);
  });

  it(`returns false for times in the future`, () => {
    expect(
      isRecordExpired({ expiryDate: Date.now() / 1000 + 30 })
    ).toStrictEqual(false);
  });

  it(`returns true for negative times`, () => {
    expect(isRecordExpired({ expiryDate: -300 })).toStrictEqual(true);
  });
});
