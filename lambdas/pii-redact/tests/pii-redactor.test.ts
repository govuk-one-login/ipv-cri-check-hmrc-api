import { defaultPatterns, redactPII } from "../src/pii-redactor";

describe("pii-redactor", () => {
  it("should redact pii using default list", async () => {
    const data = '{\\"firstName\\":\\"test\\"}';

    expect(redactPII(data)).toEqual('{\\"firstName\\": \\"***\\"}');
  });

  it("should redact pii when given a list of patterns", async () => {
    const data = "123";

    const regexes = [
      {
        regex: /\d+/g,
        replacement: "***",
      },
    ];

    expect(redactPII(data, regexes)).toEqual("***");
  });

  it("should redact pii when given a list of patterns and use the default", async () => {
    const data = '{\\"firstName\\":\\"test\\" 123}';

    const regexes = [
      {
        regex: /\d+/g,
        replacement: "***",
      },
      ...defaultPatterns,
    ];

    expect(redactPII(data, regexes)).toEqual(
      '{\\"firstName\\": \\"***\\" ***}'
    );
  });
});
