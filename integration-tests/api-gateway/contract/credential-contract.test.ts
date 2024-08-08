import { Logger } from "@aws-lambda-powertools/logger";
import { Verifier, VerifierOptions } from "@pact-foundation/pact";
import * as path from "path";
import { Constants } from "./utils/Constants";
import {
  clearContractTestsFromDatabase,
  populateDatabaseForContractTests,
} from "./utils/DatabasePopulator";

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
      // pactBrokerUrl: process.env.PACT_BROKER_URL,
      // pactBrokerUsername: process.env.PACT_BROKER_USER,
      // pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
      pactUrls: [
        path.resolve(process.cwd(), "api-gateway/contract/pact/pact.json"),
      ],
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
