import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { MetricUnit as MetricUnitType } from "@aws-lambda-powertools/metrics/types";

export const metrics = new Metrics();

const singleMetric = metrics.singleMetric();

const HTTP_METRIC_DIMENSION = "HTTP";
const RESPONSE_LATENCY_METRIC = "ResponseLatency";

export function captureMetric(name: string, value = 1, unit: MetricUnitType = MetricUnit.Count) {
  metrics.addMetric(name, unit, value);
}

export async function captureLatency<T>(name: string, callback: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();

  const res = await callback();

  const latency = Math.floor(performance.now()) - start;

  singleMetric.addDimension(HTTP_METRIC_DIMENSION, name);
  singleMetric.addMetric(RESPONSE_LATENCY_METRIC, MetricUnit.Milliseconds, latency);

  return [res, latency];
}
