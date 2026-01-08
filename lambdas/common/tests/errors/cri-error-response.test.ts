import { mockLogger } from "../../../common/tests/logger";
jest.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
import { logger } from "@govuk-one-login/cri-logger";
import { CriError } from "../../src/errors/cri-error";
import { handleErrorResponse } from "../../src/errors/cri-error-response";

describe("cri-error-response", () => {
  jest.spyOn(logger, "error");

  it("returns error with message on 400 CriError", () => {
    const error = new CriError(400, "Custom error");
    const result = handleErrorResponse(error);
    expect(result).toEqual({ body: '{"message":"Custom error"}', statusCode: 400 });
    expect(logger.error).toHaveBeenCalledWith("Cri Error thrown: " + error.message);
  });

  it("returns server error on 500 CriError", () => {
    const error = new CriError(500, "Custom error");
    const result = handleErrorResponse(error);
    expect(result).toEqual({ body: '{"message":"Internal server error"}', statusCode: 500 });
    expect(logger.error).toHaveBeenCalledWith("Cri Error thrown: " + error.message);
  });

  it("returns 500 on Error and only logs error name to avoid PII leak", () => {
    const error = new Error();
    const result = handleErrorResponse(error);
    expect(result).toEqual({ body: '{"message":"Internal server error"}', statusCode: 500 });
    expect(logger.error).toHaveBeenCalledWith("Error thrown: " + error.name);
  });

  it("returns 500 on null error", () => {
    const result = handleErrorResponse(null);
    expect(result).toEqual({ body: '{"message":"Internal server error"}', statusCode: 500 });
    expect(logger.error).toHaveBeenCalledWith("Error thrown: object");
  });
});
