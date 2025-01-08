import { MetricUnits } from "@aws-lambda-powertools/metrics";
import { MetricsHelper } from "../metrics-helper";
import { MetricDimensions, MetricNames } from "../metric-types";

jest.mock("@aws-lambda-powertools/metrics", () => ({
  ...jest.requireActual("@aws-lambda-powertools/metrics"),
  Metrics: jest.fn(() => ({
    singleMetric: () => ({
      addDimension: jest.fn(),
      addMetric: jest.fn(),
    }),
  })),
}));

const monday31st2021InMilliseconds = 1622502000000;
jest.spyOn(performance, "now").mockReturnValue(monday31st2021InMilliseconds);

describe("metrics-helper", () => {
  let metricsHelper: MetricsHelper;

  beforeEach(() => {
    metricsHelper = new MetricsHelper();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should add dimension and metric", () => {
    const value = "TestHandler";
    const latency = metricsHelper.captureResponseLatency(1622501999000, value);

    expect(latency).toEqual(1000);
    expect(metricsHelper.singleMetric.addDimension).toHaveBeenCalledWith(
      MetricDimensions.HTTP,
      value
    );
    expect(metricsHelper.singleMetric.addMetric).toHaveBeenCalledWith(
      MetricNames.ResponseLatency,
      MetricUnits.Milliseconds,
      latency
    );
  });
});
