import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { logger } from "@govuk-one-login/cri-logger";
import { metrics } from "../../common/src/util/metrics";
import { handleErrorResponse } from "../../common/src/errors/cri-error-response";
import { CriError } from "../../common/src/errors/cri-error";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { getHmrcConfig } from "../../common/src/config/get-hmrc-config";
import { getTokenFromOtg } from "../../common/src/hmrc-apis/otg";
import { callPdvMatchingApi } from "../../common/src/hmrc-apis/pdv";
import { ParsedPdvMatchResponse, PdvApiInput } from "../../common/src/hmrc-apis/types/pdv";
import { safeStringifyError } from "../../common/src/util/stringify-error";

// this user should return a 401 in both the HMRC stub and in the real HMRC API
const PDV_TEST_USER: PdvApiInput = {
  firstName: "Error",
  lastName: "NoCidForNino",
  dateOfBirth: "2000-01-01",
  nino: "AA000000A",
};

function selectMode(path: string) {
  switch (path) {
    case "/healthcheck/thirdparty":
      return "healthcheck";
    case "/healthcheck/thirdparty/info":
      return "report";
    default:
      throw new CriError(400, `Unexpected resource path: ${path}`);
  }
}

let timeRemaining = 0;

function timeout(abortSignal: AbortSignal) {
  return new Promise<undefined>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timed out after ${timeRemaining} ms!`));
    }, timeRemaining);

    abortSignal.addEventListener("abort", () => clearTimeout(timeoutId));

    if (abortSignal.aborted) clearTimeout(timeoutId);
  });
}

type AssertFunctionResultOutput<ResultType = unknown> = {
  latency: number;
  result: ResultType | undefined;
  error: string | undefined;
};

async function assertFunctionResultWithTimeout<ResultType>(
  mode: ReturnType<typeof selectMode>,
  callback: (abortSignal: AbortSignal) => Promise<ResultType>,
  checkFunction?: (result: ResultType | undefined) => { success: true } | { success: false; message: string }
): Promise<AssertFunctionResultOutput<ResultType>> {
  let result: ResultType | undefined;
  let error: string | undefined;

  const abortController = new AbortController();

  const start = performance.now();
  try {
    result = await Promise.race([callback(abortController.signal), timeout(abortController.signal)]);

    abortController.abort();

    if (checkFunction) {
      const checkOutcome = checkFunction(result);

      if (!checkOutcome.success) throw new Error(checkOutcome.message);
    }
  } catch (e) {
    if (mode === "healthcheck") throw e;
    error = safeStringifyError(e);
  }

  const latency = Math.round(performance.now() - start);
  timeRemaining -= latency;
  return { result, latency, error };
}

function loadEnvironmentVariables() {
  timeRemaining = Number(process.env.TIMEOUT_TIME_SECONDS) * 1000;
  if (!timeRemaining || Number.isNaN(timeRemaining)) throw new Error(`Please set TIMEOUT_TIME_SECONDS!`);

  const clientId = process.env.CLIENT_ID;
  if (!clientId) throw new CriError(500, "No CLIENT_ID environment variable provided!");

  if (process.env.LOG_FULL_ERRORS !== "true") throw new CriError(500, "Please set LOG_FULL_ERRORS=true!");

  return { clientId };
}

class HealthcheckHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  public async handler({ path }: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> {
    try {
      const { clientId } = loadEnvironmentVariables();

      const mode = selectMode(path);

      logger.info(`mode=${mode}. Fetching HMRC config.`);

      const hmrcConfigRes = await assertFunctionResultWithTimeout(mode, () => getHmrcConfig(clientId));
      const hmrcConfig = hmrcConfigRes.result;

      let pdvHostRes: AssertFunctionResultOutput<{ status: number; body: string }> | undefined;
      let otgRes: AssertFunctionResultOutput<string> | undefined;
      let pdvRes: AssertFunctionResultOutput<ParsedPdvMatchResponse> | undefined;

      if (hmrcConfig) {
        const pdvHost = new URL(hmrcConfig.pdv.apiUrl).origin;

        logger.info(`Checking if PDV host '${pdvHost}' is online...`);

        pdvHostRes = await assertFunctionResultWithTimeout(
          mode,
          async (signal) => {
            const response = await fetch(pdvHost, {
              method: "HEAD",
              signal,
            });
            const body = await response.text();
            return { status: response.status, body };
          },
          (result) =>
            !result || result.status >= 500
              ? {
                  success: false,
                  message: `PDV host ${pdvHost} returned unexpected code: ${result?.status}.`,
                }
              : { success: true }
        );

        logger.info(`Fetching token from OTG.`);

        otgRes = await assertFunctionResultWithTimeout(
          mode,
          (signal) => getTokenFromOtg(hmrcConfig.otg, signal),
          (result) => {
            return result ? { success: true } : { success: false, message: `Failed to retrieve OTG token!` };
          }
        );
        const otgToken = otgRes.result;

        if (otgToken) {
          logger.info(`Calling PDV API with dummy user.`);
          pdvRes = await assertFunctionResultWithTimeout(
            mode,
            (signal) => callPdvMatchingApi(hmrcConfig.pdv, otgToken, PDV_TEST_USER, signal),
            (result) =>
              result?.httpStatus === 401
                ? { success: true }
                : { success: false, message: `HMRC PDV returned unexpected response code: ${result?.httpStatus}` }
          );
          logger.info(`PDV status: ${pdvRes.result?.httpStatus}`);
        }
      }

      const response =
        mode === "report"
          ? {
              hmrcConfig: hmrcConfigRes,
              hmrcHost: pdvHostRes
                ? {
                    result: pdvHostRes.result && { status: pdvHostRes.result.status },
                    latency: pdvHostRes.latency,
                    error: pdvHostRes.error,
                  }
                : "N/A (not called due to earlier failures)",
              otg: otgRes
                ? {
                    result: otgRes.result && { tokenLength: otgRes.result.length },
                    latency: otgRes.latency,
                    error: otgRes.error,
                  }
                : "N/A (not called due to earlier failures)",
              pdv: pdvRes
                ? {
                    result: pdvRes.result && { status: pdvRes.result.httpStatus },
                    latency: pdvRes.latency,
                    error: pdvRes.error,
                  }
                : "N/A (not called due to earlier failures)",
            }
          : { message: "success" };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  }
}

const handlerClass = new HealthcheckHandler();
export const handler = handlerClass.handler.bind(handlerClass);
