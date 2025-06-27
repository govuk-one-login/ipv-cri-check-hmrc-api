import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { MetricDimensions, MetricNames } from "../../../logging/metric-types";

const metrics = new Metrics();

const singleMetric = metrics.singleMetric();

export function captureMetric(name: string, value = 1, unit = MetricUnits.Count) {
  metrics.addMetric(name, unit, value);
}

export async function captureLatency<T>(name: string, callback: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();

  const res = await callback();

  const latency = Math.floor(performance.now()) - start;

  singleMetric.addDimension(MetricDimensions.HTTP, name);
  singleMetric.addMetric(MetricNames.ResponseLatency, MetricUnits.Milliseconds, latency);

  return [res, latency];
}
