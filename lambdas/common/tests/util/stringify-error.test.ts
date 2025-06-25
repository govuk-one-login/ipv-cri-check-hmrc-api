import { safeStringifyError } from "../../src/util/stringify-error";

describe("safeStringifyError", () => {
  it("handles Error classes correctly", () => {
    const res = safeStringifyError(new Error("this better not get logged dude"));

    expect(res).toEqual("Error");
  });

  it("handles custom errors correctly", () => {
    class CustomError extends Error {
      public readonly name = "CustomError";
    }

    const res1 = safeStringifyError(new CustomError("bro!!!"));

    expect(res1).toEqual("CustomError");

    class OtherCustomError extends Error {
      public readonly name = "cool beans";
    }

    const res2 = safeStringifyError(new OtherCustomError("bro!!!"));

    expect(res2).toEqual("cool beans");
  });

  it("handles other types correctly", () => {
    const res1 = safeStringifyError("it broke!!");
    expect(res1).toEqual("string");

    const res2 = safeStringifyError({ damn: "Bro" });
    expect(res2).toEqual("object");

    const teapot = 418;
    const res3 = safeStringifyError(teapot);
    expect(res3).toEqual("number");
  });
});
