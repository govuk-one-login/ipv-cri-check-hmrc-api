import { safeStringifyError } from "../../src/util/stringify-error";

describe("safeStringifyError", () => {
  beforeEach(() => {
    process.env.LOG_FULL_ERRORS = undefined;
  });

  it("handles Error classes correctly", () => {
    const res = safeStringifyError(new Error("this better not get logged dude"));

    expect(res).toBe("Error");
  });

  it("handles custom errors correctly", () => {
    class CustomError extends Error {
      public readonly name = "CustomError";
    }

    const res1 = safeStringifyError(new CustomError("bro!!!"));

    expect(res1).toBe("CustomError");

    class OtherCustomError extends Error {
      public readonly name = "cool beans";
    }

    const res2 = safeStringifyError(new OtherCustomError("bro!!!"));

    expect(res2).toBe("cool beans");
  });

  it("handles other types correctly", () => {
    const res1 = safeStringifyError("it broke!!");
    expect(res1).toBe("string");

    const res2 = safeStringifyError({ damn: "Bro" });
    expect(res2).toBe("object");

    const teapot = 418;
    const res3 = safeStringifyError(teapot);
    expect(res3).toBe("number");
  });

  it("logs the full error when LOG_FULL_ERRORS=true", () => {
    process.env.LOG_FULL_ERRORS = "true";
    const funkyError = new Error("too much funk!");
    expect(safeStringifyError(funkyError)).toEqual(expect.stringMatching(/Error.+too much funk!/));
  });

  it("does not log the full error for any other value of LOG_FULL_ERRORS", () => {
    process.env.LOG_FULL_ERRORS = "yes!!!";
    const vibesError = new Error("too many vibes!");
    expect(safeStringifyError(vibesError)).not.toBe(expect.stringContaining("too many vibes!"));

    process.env.LOG_FULL_ERRORS = undefined;
    const beansError = new Error("beans were too cool!");
    expect(safeStringifyError(beansError)).not.toBe(expect.stringContaining("beans were too cool!"));

    process.env.LOG_FULL_ERRORS = "false";
    const jazzError = new Error("jazz too smooth!");
    expect(safeStringifyError(jazzError)).not.toBe(expect.stringContaining("jazz too smooth!"));
  });
});
