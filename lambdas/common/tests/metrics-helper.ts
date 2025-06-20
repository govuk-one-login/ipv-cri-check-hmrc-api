import { MetricsHelper } from "../../logging/metrics-helper";

export const mockMetricsHelper = {
  captureMetric: jest.fn(),
  captureResponseLatency: jest.fn().mockReturnValue(100),
} as unknown as MetricsHelper;
