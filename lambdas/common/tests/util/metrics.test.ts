import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
jest.mock("@aws-lambda-powertools/metrics");

const mockSingleMetric = {
  addDimension: jest.fn(),
  addMetric: jest.fn(),
};
const mockMetrics = {
  addMetric: jest.fn(),
  singleMetric: jest.fn().mockReturnValue(mockSingleMetric),
};
(Metrics as unknown as jest.Mock).mockReturnValue(mockMetrics);

import { captureMetric, captureLatency } from "../../src/util/metrics";
import { MetricDimensions, MetricNames } from "../../../logging/metric-types";

performance.now = jest.fn();

function waitBeforeReturning<T>(res: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(res), ms));
}

describe("metrics functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("captureMetric()", () => {
    it("captures a single metric correctly", () => {
      captureMetric("bob");

      expect(mockMetrics.addMetric).toHaveBeenCalledWith("bob", MetricUnits.Count, 1);
    });

    it("overrides the parameters correctly", () => {
      captureMetric("grug", 9999999, MetricUnits.TerabytesPerSecond);

      expect(mockMetrics.addMetric).toHaveBeenCalledWith("grug", MetricUnits.TerabytesPerSecond, 9999999);
    });
  });

  describe("captureLatency()", () => {
    it("captures latency correctly", async () => {
      (performance.now as unknown as jest.Mock).mockReturnValueOnce(1000).mockReturnValueOnce(1141.999);

      const res = await captureLatency("zoomies", () => waitBeforeReturning("good!", 80));

      expect(res).toStrictEqual(["good!", 141]);

      expect(mockSingleMetric.addDimension).toHaveBeenCalledWith(MetricDimensions.HTTP, "zoomies");
      expect(mockSingleMetric.addMetric).toHaveBeenCalledWith(
        MetricNames.ResponseLatency,
        MetricUnits.Milliseconds,
        141
      );
    });

    it("handles generic return types correctly", async () => {
      (performance.now as unknown as jest.Mock).mockReturnValueOnce(1).mockReturnValueOnce(5.999);

      const theCoolback = () =>
        waitBeforeReturning({ blah: 9, go: true, success: "maybe", thing: { stuff: false } }, 50);

      // The return type should be derived from the callback's return type.
      // If it is not, the type provided for res will cause a type error during
      // test compilation because captureLatency is returning something else.
      const res: [{ blah: number; go: boolean; success: string; thing: { stuff: boolean } }, number] =
        await captureLatency("big obj", theCoolback);

      expect(res).toStrictEqual([{ blah: 9, go: true, success: "maybe", thing: { stuff: false } }, 4]);

      expect(mockSingleMetric.addDimension).toHaveBeenCalledWith(MetricDimensions.HTTP, "big obj");
      expect(mockSingleMetric.addMetric).toHaveBeenCalledWith(MetricNames.ResponseLatency, MetricUnits.Milliseconds, 4);
    });
  });
});
