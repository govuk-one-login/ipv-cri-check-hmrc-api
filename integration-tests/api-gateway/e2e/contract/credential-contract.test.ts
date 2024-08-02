import { Logger } from "@aws-lambda-powertools/logger";
import { Verifier, VerifierOptions } from "@pact-foundation/pact";
import * as path from 'path';
import { clearAttemptsTable, clearItemsFromTables, populateTables } from "../../../resources/dynamodb-helper";
import { Constants } from "./utils/Constants";

const logger = new Logger({
	logLevel: "INFO",
	serviceName: "NinoCriVcProvider",
});

describe("Pact Verification", () => {
    
    //TODO Dont hardcode
    let sessionTableName = `session-common-cri-api`;
    let personIdentityTableName = `person-identity-common-cri-api`;

    let opts: VerifierOptions;

	beforeAll(() => {  
		opts = {
			provider: "NinoCriVcProvider",
			providerBaseUrl: `${Constants.LOCAL_HOST}:${Constants.LOCAL_APP_PORT}`,
			// pactBrokerUrl: process.env.PACT_BROKER_URL,
			// pactBrokerUsername: process.env.PACT_BROKER_USER,
    		// pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
            pactUrls: [ path.resolve(process.cwd(), "api-gateway/e2e/contract/pact/pact.json") ],		
			providerVersion: "3.0.0",
			logLevel: "info",
            // stateHandlers: {
            //     "dummyAccessToken is a valid access token": () => {
            //         return Promise.resolve(`Test`)
            //     }
            // },
		};
	});  

    beforeEach(async () => {
        await ninoCheckPassedData(
          {
            sessionId: "issue-credential-identity-passed",
            nino: "AA000003D",
          },
          "Bearer identity-check passed",
          {
            scoringPolicy: "gpg45",
            strengthScore: 2,
          }
        );
      });

    afterEach(async () => await clearData("issue-credential-identity-passed"));
  
	it("tests against potential new contracts", async () => {
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
	});

    type EvidenceRequest = {
        scoringPolicy: string;
        strengthScore: number;
      };

      const testUser = {
        nino: "AA000003D",
        dob: "1965-07-08",
        firstName: "Kenneth",
        lastName: "Decerqueira",
      };
    
    const ninoCheckPassedData = async (
        input: {
          sessionId: string;
          nino: string;
        },
        bearerToken: string,
        evidenceRequested?: EvidenceRequest
      ) => {
        await populateTables(
          {
            tableName: "mike-check-hmrc-api-nino-users",
            items: {
              sessionId: input.sessionId,
              nino: input.nino,
            },
          },
          {
            tableName: personIdentityTableName,
            items: {
              sessionId: input.sessionId,
              nino: input.nino,
              birthDates: [{ value: testUser.dob }],
              names: [
                {
                  nameParts: [
                    {
                      type: "GivenName",
                      value: testUser.firstName,
                    },
                    {
                      type: "FamilyName",
                      value: testUser.lastName,
                    },
                  ],
                },
              ],
            },
          },
          {
            tableName: sessionTableName,
            items: getSessionItem(input, bearerToken, evidenceRequested),
          },
          {
            tableName: "mike-check-hmrc-api-user-attempts",
            items: {
              sessionId: input.sessionId,
              timestamp: Date.now().toString(),
              attempts: 1,
              outcome: "PASS",
            },
          }
        );
      };

      const getSessionItem = (
        input: {
          sessionId: string;
          nino: string;
        },
        accessToken: string,
        evidenceRequest?: EvidenceRequest
      ): {
        [x: string]: unknown;
      } => ({
        sessionId: input.sessionId,
        accessToken: accessToken,
        authorizationCode: "cd8ff974-d3bc-4422-9b38-a3e5eb24adc0",
        authorizationCodeExpiryDate: "1698925598",
        expiryDate: "9999999999",
        subject: "test",
        clientId: "exampleClientId",
        clientIpAddress: "00.100.8.20",
        clientSessionId: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
        persistentSessionId: "156714ef-f9df-48c2-ada8-540e7bce44f7",
        evidenceRequest,
        txn: "mock-txn"
      });

      const clearData = async (sessionId: string) => {
        await clearItemsFromTables(
          {
            tableName: sessionTableName,
            items: { sessionId },
          },
          {
            tableName: personIdentityTableName,
            items: { sessionId },
          },
          {
            tableName: "mike-check-hmrc-api-nino-users",
            items: { sessionId },
          }
        );
        await clearAttemptsTable(sessionId, "mike-check-hmrc-api-user-attempts");
      };
});