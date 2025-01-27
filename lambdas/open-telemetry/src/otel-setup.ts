import { Tracer } from "@aws-lambda-powertools/tracer";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { AwsLambdaInstrumentation } from "@opentelemetry/instrumentation-aws-lambda";
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FsInstrumentation } from "@opentelemetry/instrumentation-fs";
import { DnsInstrumentation } from "@opentelemetry/instrumentation-dns";
import { NetInstrumentation } from "@opentelemetry/instrumentation-net";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { awsLambdaDetectorSync } from "@opentelemetry/resource-detector-aws";
import {
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
  serviceInstanceIdDetectorSync,
} from "@opentelemetry/resources";

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

export function initOpenTelemetry() {
  new NodeSDK({
    instrumentations: [
      new NetInstrumentation(),
      new FsInstrumentation(),
      new DnsInstrumentation(),
      new UndiciInstrumentation(),
      new HttpInstrumentation(),
      new AwsLambdaInstrumentation(),
      new AwsInstrumentation(),
    ],
    resourceDetectors: [
      envDetectorSync,
      osDetectorSync,
      hostDetectorSync,
      processDetectorSync,
      serviceInstanceIdDetectorSync,
      awsLambdaDetectorSync,
    ],
  }).start();
}

const tracer = new Tracer();
export default tracer;
