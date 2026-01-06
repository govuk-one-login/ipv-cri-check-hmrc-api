import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { logger } from "../../common/src/util/logger";
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
const HMRC_API_HOST = "https://api.service.hmrc.gov.uk/";

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

class HealthcheckHandler implements LambdaInterface {
  @logger.injectLambdaContext({ resetKeys: true })
  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  public async handler({ path }: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> {
    try {
      const clientId = process.env.CLIENT_ID;
      if (!clientId) throw new CriError(500, "No CLIENT_ID environment variable provided!");

      if (process.env.LOG_FULL_ERRORS !== "true") throw new CriError(500, "Please set LOG_FULL_ERRORS=true!");

      const mode = selectMode(path);

      const hmrcHostRes = await fetch(HMRC_API_HOST);
      if (hmrcHostRes.status >= 500 && mode === "healthcheck")
        throw new CriError(
          500,
          `HMRC API host ${HMRC_API_HOST} returned unexpected response code: ${hmrcHostRes.status}.`
        );

      logger.info(`HMRC host responded with code: ${hmrcHostRes.status}`);
      const hmrcConfig = await getHmrcConfig(clientId);

      let otgToken: string | undefined;
      let otgError: unknown;
      let pdvResponse: ParsedPdvMatchResponse | undefined;
      let pdvError: unknown;

      logger.info(`Fetching token from OTG.`);

      try {
        otgToken = await getTokenFromOtg(hmrcConfig.otg);
        if (!otgToken) throw new CriError(500, `Failed to retrieve OTG token!`);
        logger.info(`Retrieved token from OTG`);
      } catch (e) {
        logger.info(`Failed to retreive token from OTG`);
        if (mode === "healthcheck") throw e;
        otgError = e;
      }

      if (otgToken) {
        logger.info(`Calling PDV API with dummy user.`);
        try {
          pdvResponse = await callPdvMatchingApi(hmrcConfig.pdv, otgToken, PDV_TEST_USER);

          logger.info(`PDV status: ${pdvResponse.httpStatus}`);

          if (pdvResponse.httpStatus !== 401 && mode === "healthcheck") {
            throw new CriError(500, `HMRC PDV returned unexpected response code: ${pdvResponse.httpStatus}`);
          }
        } catch (e) {
          logger.info(`Error was thrown when calling PDV API.`);
          if (mode === "healthcheck") throw e;
          pdvError = e;
        }
      }

      const response =
        mode === "report"
          ? {
              hmrcHost: {
                url: HMRC_API_HOST,
                status: hmrcHostRes.status,
                body: await hmrcHostRes.text(),
              },
              otg: {
                url: hmrcConfig.otg.apiUrl,
                tokenLength: otgToken?.length ?? "N/A",
                error: otgError ? safeStringifyError(otgError) : undefined,
              },
              pdv: {
                url: hmrcConfig.pdv.apiUrl,
                testUser: PDV_TEST_USER,
                response: pdvResponse ?? "N/A",
                error: pdvError ? safeStringifyError(pdvError) : undefined,
              },
            }
          : { message: "success" };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error) {
      return handleErrorResponse(error, logger);
    }
  }
}

const handlerClass = new HealthcheckHandler();
export const handler = handlerClass.handler.bind(handlerClass);
