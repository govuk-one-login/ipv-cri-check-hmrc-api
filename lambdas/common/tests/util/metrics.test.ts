import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";

const { mockSingleMetric, mockMetrics } = vi.hoisted(() => {
  const mockSingleMetric = {
    addDimension: vi.fn(),
    addMetric: vi.fn(),
  };
  const mockMetrics = {
    addMetric: vi.fn(),
    singleMetric: vi.fn().mockReturnValue(mockSingleMetric),
  };
  return { mockSingleMetric, mockMetrics };
});

vi.mock("@aws-lambda-powertools/metrics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-lambda-powertools/metrics")>();
  return {
    ...actual,
    Metrics: vi.fn().mockImplementation(function () {
      return mockMetrics;
    }),
  };
});

import { captureMetric, captureLatency } from "@govuk-one-login/cri-metrics";

vi.spyOn(performance, "now");

function waitBeforeReturning<T>(res: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(res), ms));
}

describe("metrics functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMetrics.singleMetric.mockReturnValue(mockSingleMetric);
  });

  describe("captureMetric()", () => {
    it("captures a single metric correctly", () => {
      captureMetric("bob");

      expect(mockMetrics.addMetric).toHaveBeenCalledWith("bob", MetricUnit.Count, 1);
    });

    it("overrides the parameters correctly", () => {
      captureMetric("grug", 9999999, MetricUnit.TerabytesPerSecond);

      expect(mockMetrics.addMetric).toHaveBeenCalledWith("grug", MetricUnit.TerabytesPerSecond, 9999999);
    });
  });

  describe("captureLatency()", () => {
    it("captures latency correctly", async () => {
      vi.mocked(performance.now).mockReturnValueOnce(1000).mockReturnValueOnce(1141.999);

      const res = await captureLatency("zoomies", () => waitBeforeReturning("good!", 80));

      expect(res).toStrictEqual({"latencyInMs": 141, "result": "good!"});

      expect(mockSingleMetric.addDimension).toHaveBeenCalledWith("HTTP", "zoomies");
      expect(mockSingleMetric.addMetric).toHaveBeenCalledWith("ResponseLatency", MetricUnit.Milliseconds, 141);
    });

    it("handles generic return types correctly", async () => {
      vi.mocked(performance.now).mockReturnValueOnce(1).mockReturnValueOnce(5.999);

      const theCoolback = () =>
        waitBeforeReturning({ blah: 9, go: true, success: "maybe", thing: { stuff: false } }, 50);

      // The return type should be derived from the callback's return type.
      // If it is not, the type provided for res will cause a type error during
      // test compilation because captureLatency is returning something else.
      const res: {
        result: { blah: number; go: boolean; success: string; thing: { stuff: boolean } };
        latencyInMs: number;
      } = await captureLatency("big obj", theCoolback);

      expect(res.result).toStrictEqual({ blah: 9, go: true, success: "maybe", thing: { stuff: false } });
      expect(res.latencyInMs).toStrictEqual(4);

      expect(mockSingleMetric.addDimension).toHaveBeenCalledWith("HTTP", "big obj");
      expect(mockSingleMetric.addMetric).toHaveBeenCalledWith("ResponseLatency", MetricUnit.Milliseconds, 4);
    });
  });
});
