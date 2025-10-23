import { Logger } from "@aws-lambda-powertools/logger";
import { Verifier, VerifierOptions } from "@pact-foundation/pact";
import { Constants } from "./utils/Constants";
import { clearContractTestsFromDatabase, populateDatabaseForContractTests } from "./utils/DatabasePopulator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const logger = new Logger({
  logLevel: "INFO",
  serviceName: "NinoCriVcProvider",
});

describe("Pact Verification", () => {
  let opts: VerifierOptions;

  beforeAll(() => {
    opts = {
      provider: "NinoCriVcProvider",
      providerBaseUrl: `${Constants.LOCAL_HOST}:${Constants.LOCAL_APP_PORT}`,
      pactBrokerUrl: "https://" + process.env.PACT_BROKER_HOST,
      pactBrokerUsername: process.env.PACT_BROKER_USERNAME,
      pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
      consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
      publishVerificationResult: true,
      providerVersion: "3.0.0",
      logLevel: "info",
    };
  });

  beforeEach(async () => await populateDatabaseForContractTests());

  afterAll(async () => await clearContractTestsFromDatabase());

  it("tests against contracts", async () => {
    logger.debug("Starting Pact Verification");
    let result;
    await new Verifier(opts)
      .verifyProvider()
      .then((output) => {
        logger.info("Pact Verification Complete!");
        logger.info("Output: ", output);
        result = Number(output.match(/\d+/));
      })
      .catch((error) => {
        logger.error("Pact verification failed :(", { error });
        result = 1;
      });
    expect(result).toBe(0);
  }, 60000);
});
