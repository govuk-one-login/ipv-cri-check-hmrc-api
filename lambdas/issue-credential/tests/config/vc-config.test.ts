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

  const mockCommonStackName = "test-stack";
  const expectedVcSigningKeyId = `/${mockCommonStackName}/verifiableCredentialKmsSigningKeyId`;
  const expectedErrorMapping = "/check-hmrc-cri-api/contraindicationMappings";
  const expectedReasonsMapping = "/check-hmrc-cri-api/contraIndicatorReasonsMapping";

  const mockSsmParams: Record<string, string> = {
    [expectedVcSigningKeyId]: "test-signing-key-id",
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

      const result: VcCheckConfig = await getVcConfig(mockCommonStackName);

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

      await getVcConfig(mockCommonStackName);

      expect(getParametersValuesSpy).toHaveBeenCalledWith(
        [expectedVcSigningKeyId, expectedErrorMapping, expectedReasonsMapping],
        300
      );
      expect(getParametersValuesSpy).toHaveBeenCalledTimes(1);
    });

    it("logs info message when retrieving parameters", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);
      jest.spyOn(logger, "info");

      await getVcConfig(mockCommonStackName);

      expect(logger.info).toHaveBeenCalledWith("Retrieved Check Hmrc VC parameters.");
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it("handles empty error mapping string", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedErrorMapping]: "",
      });

      const result = await getVcConfig(mockCommonStackName);

      expect(result.contraIndicator.errorMapping).toEqual([""]);
    });

    it("handles single error mapping without delimiter", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedErrorMapping]: "single-error",
      });

      const result = await getVcConfig(mockCommonStackName);

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

      const result = await getVcConfig(mockCommonStackName);

      expect(result.contraIndicator.reasonsMapping).toEqual(multipleReasons);
    });
  });

  describe("error handling", () => {
    it("throws CriError when getParametersValues throws Error", async () => {
      getParametersValuesSpy.mockRejectedValue(new Error("SSM parameter not found"));

      await expect(getVcConfig(mockCommonStackName)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: SSM parameter not found")
      );
    });

    it("throws CriError when getParametersValues throws non-Error", async () => {
      getParametersValuesSpy.mockRejectedValueOnce("String error");

      await expect(getVcConfig(mockCommonStackName)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: String error")
      );
    });

    it("throws CriError when getParametersValues throws null", async () => {
      getParametersValuesSpy.mockRejectedValue(null);

      await expect(getVcConfig(mockCommonStackName)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: null")
      );
    });

    it("throws CriError when getParametersValues throws undefined", async () => {
      getParametersValuesSpy.mockRejectedValue(undefined);

      await expect(getVcConfig(mockCommonStackName)).rejects.toThrow(
        new CriError(500, "Failed to load VC config: undefined")
      );
    });

    it("throws CriError when JSON.parse fails on reasonsMapping", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedReasonsMapping]: "invalid-json",
      });

      await expect(getVcConfig(mockCommonStackName)).rejects.toThrow(CriError);
      await expect(getVcConfig(mockCommonStackName)).rejects.toThrow(
        expect.objectContaining({
          status: 500,
          message: expect.stringContaining("Failed to load VC config:"),
        })
      );
    });

    it("preserves original error message in CriError", async () => {
      const specificErrorMessage = "Specific AWS SSM error occurred";
      getParametersValuesSpy.mockRejectedValueOnce(new Error(specificErrorMessage));

      await expect(getVcConfig(mockCommonStackName)).rejects.toThrow(
        new CriError(500, `Failed to load VC config: ${specificErrorMessage}`)
      );
    });
  });

  describe("parameter path construction", () => {
    it("constructs correct vcSigningKeyId path with different stack names", async () => {
      const customStackName = "custom-stack-name";
      const expectedCustomPath = `/${customStackName}/verifiableCredentialKmsSigningKeyId`;

      getParametersValuesSpy.mockResolvedValueOnce({
        [expectedCustomPath]: "custom-key-id",
        [expectedErrorMapping]: "error1||error2",
        [expectedReasonsMapping]: JSON.stringify([]),
      });

      await getVcConfig(customStackName);

      expect(getParametersValuesSpy).toHaveBeenCalledWith(
        [expectedCustomPath, expectedErrorMapping, expectedReasonsMapping],
        300
      );
    });

    it("handles stack names with special characters", async () => {
      const specialStackName = "stack-with-123_special.chars";
      const expectedSpecialPath = `/${specialStackName}/verifiableCredentialKmsSigningKeyId`;

      const specialMockParams = {
        [expectedSpecialPath]: "special-key-id",
        [expectedErrorMapping]: "error1",
        [expectedReasonsMapping]: JSON.stringify([]),
      };

      getParametersValuesSpy.mockResolvedValueOnce(specialMockParams);

      const result = await getVcConfig(specialStackName);

      expect(result.kms.signingKeyId).toBe("special-key-id");
      expect(getParametersValuesSpy).toHaveBeenCalledWith(
        [expectedSpecialPath, expectedErrorMapping, expectedReasonsMapping],
        300
      );
    });
  });

  describe("type safety", () => {
    it("returns object matching VcCheckConfig type", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);

      const result = await getVcConfig(mockCommonStackName);

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
    it("handles empty commonStackName", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        "//verifiableCredentialKmsSigningKeyId": "empty-stack-key",
        [expectedErrorMapping]: "error1",
        [expectedReasonsMapping]: JSON.stringify([]),
      });

      const result = await getVcConfig("");

      expect(getParametersValuesSpy).toHaveBeenCalledWith(
        ["//verifiableCredentialKmsSigningKeyId", expectedErrorMapping, expectedReasonsMapping],
        300
      );
      expect(result.kms.signingKeyId).toBe("empty-stack-key");
    });

    it("handles reasonsMapping as empty array", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedReasonsMapping]: "[]",
      });

      const result = await getVcConfig(mockCommonStackName);

      expect(result.contraIndicator.reasonsMapping).toEqual([]);
    });

    it("handles multiple consecutive delimiters in errorMapping", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [expectedErrorMapping]: "error1||||error2||error3",
      });

      const result = await getVcConfig(mockCommonStackName);

      expect(result.contraIndicator.errorMapping).toEqual(["error1", "", "error2", "error3"]);
    });
  });
});
