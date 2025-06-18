import { Logger } from "@aws-lambda-powertools/logger";
import { CriError } from "../../src/errors/cri-error";
import { handleErrorResponse } from "../../src/errors/cri-error-response";

describe("cri-error-response", () => {
  const logger = new Logger();
  jest.spyOn(logger, "error");

  it("returns error with message on 400 CriError", () => {
    const error = new CriError(400, "Custom error");
    const result = handleErrorResponse(error, logger);
    expect(result).toEqual({ body: '{"message":"Custom error"}', statusCode: 400 });
    expect(logger.error).toHaveBeenCalledWith("Cri Error thrown: " + error.message);
  });

  it("returns server error on 500 CriError", () => {
    const error = new CriError(500, "Custom error");
    const result = handleErrorResponse(error, logger);
    expect(result).toEqual({ body: '{"message":"Internal server error"}', statusCode: 500 });
    expect(logger.error).toHaveBeenCalledWith("Cri Error thrown: " + error.message);
  });

  it("returns 500 on Error and only logs error name to avoid PII leak", () => {
    const error = new Error();
    const result = handleErrorResponse(error, logger);
    expect(result).toEqual({ body: '{"message":"Internal server error"}', statusCode: 500 });
    expect(logger.error).toHaveBeenCalledWith("Error thrown: " + error.name);
  });

  it("returns 500 on null error", () => {
    const result = handleErrorResponse(null, logger);
    expect(result).toEqual({ body: '{"message":"Internal server error"}', statusCode: 500 });
    expect(logger.error).toHaveBeenCalledWith("Unknown error thrown");
  });
});
