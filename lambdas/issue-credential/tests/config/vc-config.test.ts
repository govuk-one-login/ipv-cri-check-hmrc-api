import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockLogger } from "../../../common/tests/logger";
vi.mock("@govuk-one-login/cri-logger", () => ({
  logger: mockLogger,
}));
import type { MockInstance } from "vitest";
import { CriError } from "@govuk-one-login/cri-error-response";
import * as GetParameters from "../../../common/src/util/get-parameters";
import { logger } from "@govuk-one-login/cri-logger";
import { VcCheckConfig, getVcConfig } from "../../src/config/vc-config";
import { CiMappingEntry, ContraIndicator } from "../../src/vc/contraIndicator/types";

type spyGetParametersValues = MockInstance<
  (parameterPaths: string[], cacheTtlInSeconds?: number) => Promise<Record<string, string>>
>;

describe("getVcConfig", () => {
  let getParametersValuesSpy: spyGetParametersValues;

  const mockVcSigningKeyId = "test-signing-key-id";
  const ciMappingParamName = "/check-hmrc-cri-api/contraindicationMappings";
  const reasonMappingParamName = "/check-hmrc-cri-api/contraIndicatorReasonsMapping";

  const validReasonMapping: ContraIndicator[] = [
    { ci: "ci_1", reason: "ci_1 reason" },
    { ci: "ci_2", reason: "ci_2 reason" },
    { ci: "ci_3", reason: "ci_3 reason" },
  ];

  const validCiMapping: CiMappingEntry[] = [
    { mappedHmrcErrors: ["AN ERROR DESCRIPTION", "WITH A COMMA", "AAAA"], ciValue: "ci_1" },
    { mappedHmrcErrors: ["A SECOND ONE WITH", "A COMMA", "BBBB", "CCCC", "DDDD"], ciValue: "ci_2" },
    { mappedHmrcErrors: ["ANOTHER ERROR", "DESCRIPTION", "EEEE", "FFFF", "GGGG"], ciValue: "ci_3" },
  ];

  const mockSsmParams: Record<string, string> = {
    [ciMappingParamName]:
      "An error description, with a comma, aaaa:ci_1||A second one with, a comma, bbbb,cccc,dddd:ci_2||Another error, description, eeee,ffff,gggg:ci_3",
    [reasonMappingParamName]: JSON.stringify(validReasonMapping),
  };

  beforeEach(() => {
    getParametersValuesSpy = vi.spyOn(GetParameters, "getParametersValues");
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  describe("successful configuration retrieval", () => {
    it("returns correctly typed VcCheckConfig with valid parameters", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);

      const result: VcCheckConfig = await getVcConfig(mockVcSigningKeyId);

      expect(result).toEqual({
        kms: { signingKeyId: "test-signing-key-id" },
        contraIndicator: {
          ciMapping: validCiMapping,
          reasonsMapping: validReasonMapping,
        },
      });
    });

    it("calls getParametersValues with correct parameter paths", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);

      await getVcConfig(mockVcSigningKeyId);

      expect(getParametersValuesSpy).toHaveBeenCalledWith([ciMappingParamName, reasonMappingParamName], 300);
      expect(getParametersValuesSpy).toHaveBeenCalledTimes(1);
    });

    it("logs info message when retrieving parameters", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);
      vi.spyOn(logger, "info");

      await getVcConfig(mockVcSigningKeyId);

      expect(logger.info).toHaveBeenCalledWith("Retrieved Check Hmrc VC parameters.");
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it("throws for an empty error mapping string", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [ciMappingParamName]: "",
      });

      await expect(() => getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        "ContraIndicationMapping cannot be undefined in CiMappingEvent"
      );
    });

    it("throws for a CI mapping without delimiters", async () => {
      getParametersValuesSpy.mockResolvedValueOnce({
        ...mockSsmParams,
        [ciMappingParamName]: "single-error",
      });

      await expect(() => getVcConfig(mockVcSigningKeyId)).rejects.toThrow("ContraIndicationMapping format is invalid");
    });

    it("correctly handles JSON in reasonsMapping", async () => {
      const multipleReasons = [
        { ci: "ci_1", reason: "Complex reason" },
        { ci: "ci_2", reason: "Another reason" },
        { ci: "ci_3", reason: "Last reason" },
      ];

      getParametersValuesSpy.mockResolvedValue({
        ...mockSsmParams,
        [reasonMappingParamName]: JSON.stringify(multipleReasons),
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
        [reasonMappingParamName]: "invalid-json",
      });

      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(CriError);
      await expect(getVcConfig(mockVcSigningKeyId)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 500,
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
    it("returns an object matching VcCheckConfig type", async () => {
      getParametersValuesSpy.mockResolvedValueOnce(mockSsmParams);

      const result = await getVcConfig(mockVcSigningKeyId);

      expect(typeof result.kms.signingKeyId).toBe("string");
      expect(Array.isArray(result.contraIndicator.ciMapping)).toBe(true);
      expect(Array.isArray(result.contraIndicator.reasonsMapping)).toBe(true);

      const kmsConfig: { signingKeyId: string } = result.kms;
      const contraConfig: { ciMapping: CiMappingEntry[]; reasonsMapping: ContraIndicator[] } = result.contraIndicator;

      expect(kmsConfig.signingKeyId).toBeDefined();
      expect(contraConfig.ciMapping).toBeDefined();
      expect(contraConfig.reasonsMapping).toBeDefined();
    });
  });
});
