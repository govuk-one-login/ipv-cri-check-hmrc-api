import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { MetricDimensions, MetricNames } from "./metric-types";

export class MetricsHelper {
  singleMetric: Metrics;

  constructor(public readonly metrics = new Metrics()) {
    this.singleMetric = metrics.singleMetric();
  }

  public captureMetric(name: string, value = 1, unit = MetricUnits.Count) {
    this.metrics.addMetric(name, unit, value);
  }

  captureResponseLatency(start: number, metricValue: string): number {
    const latency = Math.floor(performance.now()) - start;

    this.singleMetric.addDimension(MetricDimensions.HTTP, metricValue);
    this.singleMetric.addMetric(MetricNames.ResponseLatency, MetricUnits.Milliseconds, latency);

    return latency;
  }
}
