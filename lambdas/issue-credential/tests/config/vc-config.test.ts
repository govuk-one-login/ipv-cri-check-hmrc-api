import { mockLogger } from "../../../common/tests/logger";
jest.mock("../../../common/src/util/logger", () => ({
  logger: mockLogger,
}));
import { CriError } from "../../../common/src/errors/cri-error";
import * as GetParameters from "../../../common/src/util/get-parameters";
import { logger } from "../../../common/src/util/logger";
import { VcCheckConfig, getVcConfig } from "../../src/config/vc-config";

type spyGetParametersValues = jest.SpyInstance<
  Promise<Record<string, string>>,
  [parameterPaths: string[], cacheTtlInSeconds?: number]
>;

describe("getVcConfig", () => {
  let getParametersValuesSpy: spyGetParametersValues;

  const mockVcSigningKeyId = "test-signing-key-id";
  const expectedErrorMapping = "/check-hmrc-cri-api/contraindicationMappings";
  const expectedReasonsMapping = "/check-hmrc-cri-api/contraIndicatorReasonsMapping";

  const mockSsmParams: Record<string, string> = {
    [expectedErrorMapping]: "error1||error2||error3",
    [expectedReasonsMapping]: JSON.stringify([
      { code: "A", reason: "Reason A" },
      { code: "B", reason: "Reason B" },
    ]),
  };

  beforeEach(() => {
    getParametersValuesSpy = jest.spyOn(GetParameters, "getParametersValues");
    jest.clearAllMocks();
  });

  afterEach(() => jest.restoreAllMocks());

  describe("successful configuration retrieval", () => {
    it("returns correctly typed VcCheckConfig with valid parameters", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);

      const result: VcCheckConfig = await getVcConfig(mockVcSigningKeyId);

      expect(result).toEqual({
        kms: { signingKeyId: "test-signing-key-id" },
        contraIndicator: {
          errorMapping: ["error1", "error2", "error3"],
          reasonsMapping: [
            { code: "A", reason: "Reason A" },
            { code: "B", reason: "Reason B" },
          ],
        },
      });
    });

    it("calls getParametersValues with correct parameter paths", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);

      await getVcConfig(mockVcSigningKeyId);

      expect(getParametersValuesSpy).toHaveBeenCalledWith([expectedErrorMapping, expectedReasonsMapping], 300);
      expect(getParametersValuesSpy).toHaveBeenCalledTimes(1);
    });

    it("logs info message when retrieving parameters", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);
      jest.spyOn(logger, "info");

      await getVcConfig(mockVcSigningKeyId);

      expect(logger.info).toHaveBeenCalledWith("Retrieved Check Hmrc VC parameters.");
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it("handles empty error mapping string", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedErrorMapping]: "",
      });

      const result = await getVcConfig(mockVcSigningKeyId);

      expect(result.contraIndicator.errorMapping).toEqual([""]);
    });

    it("handles single error mapping without delimiter", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedErrorMapping]: "single-error",
      });

      const result = await getVcConfig(mockVcSigningKeyId);

      expect(result.contraIndicator.errorMapping).toEqual(["single-error"]);
    });

    it("handles complex JSON in reasonsMapping", async () => {
      const multipleReasons = [
        { code: "X", reason: "Complex reason" },
        { code: "Y", reason: "Another reason" },
      ];

      getParametersValuesSpy.mockResolvedValue({
        ...mockSsmParams,
        [expectedReasonsMapping]: JSON.stringify(multipleReasons),
      });

      const result = await getVcConfig(mockVcSigningKeyId);

      expect(result.contraIndicator.reasonsMapping).toEqual(multipleReasons);
    });
  });

  describe("error handling", () => {
    it("throws CriError when getParametersValues throws Error", async () => {
      getParametersValuesSpy.mockRejectedValue(new Error("SSM parameter not found"));

      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: SSM parameter not found")
      );
    });

    it("throws CriError when getParametersValues throws non-Error", async () => {
      getParametersValuesSpy.mockRejectedValueOnce("String error");

      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: String error")
      );
    });

    it("throws CriError when getParametersValues throws null", async () => {
      getParametersValuesSpy.mockRejectedValue(null);

      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: null")
      );
    });

    it("throws CriError when getParametersValues throws undefined", async () => {
      getParametersValuesSpy.mockRejectedValue(undefined);

      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: undefined")
      );
    });

    it("throws CriError when JSON.parse fails on reasonsMapping", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedReasonsMapping]: "invalid-json",
      });

      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(CriError);
      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        expect.objectContaining({
          status: 500,
          message: expect.stringContaining("Failed to load VC config:"),
        })
      );
    });

    it("preserves original error message in CriError", async () => {
      const specificErrorMessage = "Specific AWS SSM error occurred";
      getParametersValuesSpy.mockRejectedValueOnce(new Error(specificErrorMessage));

      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        new CriError(500, `Failed to load VC config: ${specificErrorMessage}`)
      );
    });
  });

  describe("type safety", () => {
    it("returns object matching VcCheckConfig type", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);

      const result = await getVcConfig(mockVcSigningKeyId);

      expect(typeof result.kms.signingKeyId).toBe("string");
      expect(Array.isArray(result.contraIndicator.errorMapping)).toBe(true);
      expect(Array.isArray(result.contraIndicator.reasonsMapping)).toBe(true);

      const kmsConfig: { signingKeyId: string } = result.kms;
      const contraConfig: { errorMapping: string[]; reasonsMapping: object[] } = result.contraIndicator;

      expect(kmsConfig.signingKeyId).toBeDefined();
      expect(contraConfig.errorMapping).toBeDefined();
      expect(contraConfig.reasonsMapping).toBeDefined();
    });
  });

  describe("some edge cases", () => {
    it("handles reasonsMapping as empty array", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedReasonsMapping]: "[]",
      });

      const result = await getVcConfig(mockVcSigningKeyId);

      expect(result.contraIndicator.reasonsMapping).toEqual([]);
    });

    it("handles multiple consecutive delimiters in errorMapping", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedErrorMapping]: "error1||||error2||error3",
      });

      const result = await getVcConfig(mockVcSigningKeyId);

      expect(result.contraIndicator.errorMapping).toEqual(["error1", "", "error2", "error3"]);
    });
  });
});
