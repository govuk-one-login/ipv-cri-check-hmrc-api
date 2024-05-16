import { JWK, importJWK, jwtVerify } from "jose";
import { createPublicKey } from "crypto";
import { stackOutputs } from "../../../resources/cloudformation-helper";
import { executeStepFunction } from "../../../resources/stepfunction-helper";
import {
  clearAttemptsTable,
  clearItemsFromTables,
  populateTables,
} from "../../../resources/dynamodb-helper";

import { getSSMParameter } from "../../../resources/ssm-param-helper";
import { getPublicKey } from "../../../resources/kms-helper";
import {
  deleteQueue,
  getQueueMessages,
  setUpQueueAndAttachToRule,
  targetId,
} from "../../../resources/queue-helper";
import { removeTargetFromRule } from "../../../resources/event-bridge-helper";
import { retry } from "../../../resources/util";
import { CreateQueueCommandOutput } from "@aws-sdk/client-sqs";

jest.setTimeout(30_000);

type EvidenceRequest = {
  scoringPolicy: string;
  strengthScore: number;
};

describe("nino-issue-credential-happy", () => {
  const input = {
    sessionId: "issue-credential-happy",
    nino: "AA000003D",
  };

  const testUser = {
    nino: "AA000003D",
    dob: "1948-04-23",
    firstName: "Jim",
    lastName: "Ferguson",
  };

  let sessionTableName: string;
  let personIdentityTableName: string;

  let output: Partial<{
    CommonStackName: string;
    UserAttemptsTable: string;
    NinoUsersTable: string;
    NinoIssueCredentialStateMachineArn: string;
    AuditEventVcIssuedRule: string;
    AuditEventEndRule: string;
    AuditEventEndRuleArn: string;
    AuditEventVcIssuedRuleArn: string;
    TxMaAuditEventRule: string;
    TxMaAuditEventRuleArn: string;
  }>;

  beforeEach(async () => {
    output = await stackOutputs(process.env.STACK_NAME);
    sessionTableName = `session-${output.CommonStackName}`;
    personIdentityTableName = `person-identity-${output.CommonStackName}`;

    await populateTables(
      {
        tableName: output.NinoUsersTable as string,
        items: {
          sessionId: input.sessionId,
          nino: "AA000003D",
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
      }
    );
  });
  afterEach(async () => {
    await clearItemsFromTables(
      {
        tableName: sessionTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: personIdentityTableName,
        items: { sessionId: input.sessionId },
      },
      {
        tableName: output.NinoUsersTable as string,
        items: { sessionId: input.sessionId },
      }
    );
    await clearAttemptsTable(input.sessionId, output.UserAttemptsTable);
  });

  describe("Nino Check Hmrc Issue Credential", () => {
    describe("Identity Check", () => {
      describe("passed with success check details", () => {
        beforeEach(async () => {
          await populateTables(
            {
              tableName: sessionTableName,
              items: getSessionItem(input, "Bearer happy", {
                scoringPolicy: "gpg45",
                strengthScore: 2,
              }),
            },
            {
              tableName: output.UserAttemptsTable as string,
              items: {
                sessionId: input.sessionId,
                timestamp: Date.now().toString(),
                attempts: 1,
                outcome: "PASS",
              },
            }
          );
        });

        it("should create the valid expiry date", async () => {
          const startExecutionResult = await getExecutionResult("Bearer happy");
          const token = JSON.parse(startExecutionResult.output as string);
          const [_, payloadEncoded, __] = token.jwt.split(".");
          const payload = JSON.parse(base64decode(payloadEncoded));

          expect(isValidTimestamp(payload.exp)).toBe(true);
          expect(isValidTimestamp(payload.nbf)).toBe(true);
          expect(payload.exp).toBe(payload.nbf + 120 * 60);
        });

        it("should have a VC with a valid signature", async () => {
          const kid = (await getSSMParameter(
            `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
          )) as string;
          const alg = (await getSSMParameter(
            `/${output.CommonStackName}/clients/ipv-core-stub-aws-build/jwtAuthentication/authenticationAlg`
          )) as string;

          const startExecutionResult = await getExecutionResult("Bearer happy");
          const token = JSON.parse(startExecutionResult.output as string);

          const signingPublicJwk = await createSigningPublicJWK(kid, alg);
          const publicVerifyingJwk = await importJWK(
            signingPublicJwk,
            signingPublicJwk?.alg || alg
          );

          const { payload } = await jwtVerify(token.jwt, publicVerifyingJwk, {
            algorithms: [alg],
          });

          const result = await aVcWithCheckDetails();
          expect(isValidTimestamp(payload.exp || 0)).toBe(true);
          expect(isValidTimestamp(payload.nbf || 0)).toBe(true);
          expect(payload).toEqual(result);
        });
        it("should create a VC with a checkDetail, Validity Score of 2 and no Ci", async () => {
          const startExecutionResult = await getExecutionResult("Bearer happy");

          const currentCredentialKmsSigningKeyId = await getSSMParameter(
            `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
          );

          const token = JSON.parse(startExecutionResult.output as string);

          const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
          const header = JSON.parse(base64decode(headerEncoded));
          const payload = JSON.parse(base64decode(payloadEncoded));

          expect(header).toEqual({
            typ: "JWT",
            alg: "ES256",
            kid: currentCredentialKmsSigningKeyId,
          });

          const result = await aVcWithCheckDetails();
          expect(isValidTimestamp(payload.exp)).toBe(true);
          expect(isValidTimestamp(payload.nbf)).toBe(true);
          expect(payload).toEqual(result);
        });
      });
      describe("failed with check details", () => {
        beforeEach(async () => {
          await populateTables(
            {
              tableName: sessionTableName,
              items: getSessionItem(input, "Bearer unhappy", {
                scoringPolicy: "gpg45",
                strengthScore: 2,
              }),
            },
            {
              tableName: output.UserAttemptsTable as string,
              items: {
                sessionId: input.sessionId,
                timestamp: Date.now().toString() + 1,
                attempt: "FAIL",
                status: 200,
                text: "DOB does not match CID, First Name does not match CID",
              },
            },
            {
              tableName: output.UserAttemptsTable as string,
              items: {
                sessionId: input.sessionId,
                timestamp: Date.now().toString(),
                attempt: "FAIL",
                status: 200,
                text: "DOB does not match CID, First Name does not match CID",
              },
            }
          );
        });

        it("should have a VC with a valid signature", async () => {
          const kid = (await getSSMParameter(
            `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
          )) as string;
          const alg = (await getSSMParameter(
            `/${output.CommonStackName}/clients/ipv-core-stub-aws-build/jwtAuthentication/authenticationAlg`
          )) as string;

          const startExecutionResult =
            await getExecutionResult("Bearer unhappy");
          const token = JSON.parse(startExecutionResult.output as string);

          const signingPublicJwk = await createSigningPublicJWK(kid, alg);
          const publicVerifyingJwk = await importJWK(
            signingPublicJwk,
            signingPublicJwk?.alg || alg
          );

          const { payload } = await jwtVerify(token.jwt, publicVerifyingJwk, {
            algorithms: [alg],
          });

          const result = await aVcWithFailedCheckDetailsAndCi();
          expect(isValidTimestamp(payload.exp || 0)).toBe(true);
          expect(isValidTimestamp(payload.nbf || 0)).toBe(true);
          expect(payload).toEqual(result);
        });

        it("should create a VC with a failedCheckDetail, validity score of 0 and Ci", async () => {
          const startExecutionResult =
            await getExecutionResult("Bearer unhappy");

          const currentCredentialKmsSigningKeyId = await getSSMParameter(
            `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
          );

          const token = JSON.parse(startExecutionResult.output as string);

          const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
          const header = JSON.parse(base64decode(headerEncoded));
          const payload = JSON.parse(base64decode(payloadEncoded));

          expect(header).toEqual({
            typ: "JWT",
            alg: "ES256",
            kid: currentCredentialKmsSigningKeyId,
          });

          const result = await aVcWithFailedCheckDetailsAndCi();
          expect(isValidTimestamp(payload.exp)).toBe(true);
          expect(isValidTimestamp(payload.nbf)).toBe(true);
          expect(payload).toEqual(result);
        });
      });
    });

    describe("Record Check", () => {
      describe("passed with success check details", () => {
        beforeEach(async () => {
          await populateTables(
            {
              tableName: sessionTableName,
              items: getSessionItem(input, "Bearer happy"),
            },
            {
              tableName: output.UserAttemptsTable as string,
              items: {
                sessionId: input.sessionId,
                timestamp: Date.now().toString(),
                attempts: 1,
                outcome: "PASS",
              },
            }
          );
        });
        it("should create a VC with a checkDetail Record Check with no scores", async () => {
          const startExecutionResult = await getExecutionResult("Bearer happy");

          const currentCredentialKmsSigningKeyId = await getSSMParameter(
            `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
          );

          const token = JSON.parse(startExecutionResult.output as string);

          const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
          const header = JSON.parse(base64decode(headerEncoded));
          const payload = JSON.parse(base64decode(payloadEncoded));

          expect(header).toEqual({
            typ: "JWT",
            alg: "ES256",
            kid: currentCredentialKmsSigningKeyId,
          });

          const result = await aVcWithCheckDetailsDataCheck();
          expect(isValidTimestamp(payload.exp)).toBe(true);
          expect(isValidTimestamp(payload.nbf)).toBe(true);
          expect(payload).toEqual(result);
        });
      });

      describe("failed with", () => {
        beforeEach(async () => {
          await populateTables(
            {
              tableName: sessionTableName,
              items: getSessionItem(input, "Bearer unhappy"),
            },
            {
              tableName: output.UserAttemptsTable as string,
              items: {
                sessionId: input.sessionId,
                timestamp: Date.now().toString() + 1,
                attempt: "FAIL",
                status: 200,
                text: "DOB does not match CID, First Name does not match CID",
              },
            },
            {
              tableName: output.UserAttemptsTable as string,
              items: {
                sessionId: input.sessionId,
                timestamp: Date.now().toString(),
                attempt: "FAIL",
                status: 200,
                text: "DOB does not match CID, First Name does not match CID",
              },
            }
          );
        });
        describe("check details no scores", () => {
          it("should create a VC with a failedCheckDetail for Record Check", async () => {
            const startExecutionResult =
              await getExecutionResult("Bearer unhappy");

            const currentCredentialKmsSigningKeyId = await getSSMParameter(
              `/${output.CommonStackName}/verifiableCredentialKmsSigningKeyId`
            );

            const token = JSON.parse(startExecutionResult.output as string);

            const [headerEncoded, payloadEncoded, _] = token.jwt.split(".");
            const header = JSON.parse(base64decode(headerEncoded));
            const payload = JSON.parse(base64decode(payloadEncoded));

            expect(header).toEqual({
              typ: "JWT",
              alg: "ES256",
              kid: currentCredentialKmsSigningKeyId,
            });

            const result = await aVcWithFailedCheckDetailsRecordCheck();
            expect(isValidTimestamp(payload.exp)).toBe(true);
            expect(isValidTimestamp(payload.nbf)).toBe(true);
            expect(payload).toEqual(result);
          });
        });
        describe("step function publishes to EventBridge Bus", () => {
          jest.setTimeout(120_000);
          let vcIssuedEventTestQueue: CreateQueueCommandOutput;
          let endEventTestQueue: CreateQueueCommandOutput;

          beforeEach(async () => {
            const [checkHmrcEventBus, vcIssuedRuleName] = (
              output.AuditEventVcIssuedRule as string
            ).split("|");
            const [_, endRuleName] = (output.AuditEventEndRule as string).split(
              "|"
            );
            vcIssuedEventTestQueue = await setUpQueueAndAttachToRule(
              output.AuditEventVcIssuedRuleArn as string,
              vcIssuedRuleName,
              checkHmrcEventBus
            );
            endEventTestQueue = await setUpQueueAndAttachToRule(
              output.AuditEventEndRuleArn as string,
              endRuleName,
              checkHmrcEventBus
            );
          });
          afterEach(async () => {
            const [checkHmrcEventBus, vcIssuedRuleName] = (
              output.AuditEventVcIssuedRule as string
            ).split("|");
            const [_, endRuleName] = (output.AuditEventEndRule as string).split(
              "|"
            );
            await retry(async () => {
              await Promise.all([
                removeTargetFromRule(
                  targetId,
                  checkHmrcEventBus,
                  vcIssuedRuleName
                ),
                removeTargetFromRule(targetId, checkHmrcEventBus, endRuleName),
              ]);
            });
            await retry(async () => {
              await Promise.all([
                deleteQueue(vcIssuedEventTestQueue.QueueUrl),
                deleteQueue(endEventTestQueue.QueueUrl),
              ]);
            });
          });
          it("should publish END event to CheckHmrcBus successfully", async () => {
            const startExecutionResult =
              await getExecutionResult("Bearer unhappy");
            const endEventTestQueueMessage = await getQueueMessages(
              endEventTestQueue.QueueUrl as string
            );
            const { "detail-type": endDetailType, source: endSource } =
              JSON.parse(endEventTestQueueMessage[0].Body as string);

            expect(startExecutionResult.output).toBeDefined();
            expect(endEventTestQueueMessage).not.toHaveLength(0);
            expect(endDetailType).toBe("END");
            expect(endSource).toBe("review-hc.localdev.account.gov.uk");
          });
          it("should publish VC_ISSUED event to CheckHmrcBus", async () => {
            const startExecutionResult =
              await getExecutionResult("Bearer unhappy");

            const vcIssuedTestQueueMessage = await getQueueMessages(
              vcIssuedEventTestQueue.QueueUrl as string
            );

            const {
              "detail-type": vcIssuedDetailType,
              source: vcIssuedSource,
            } = JSON.parse(vcIssuedTestQueueMessage[0].Body as string);

            expect(startExecutionResult.output).toBeDefined();
            expect(vcIssuedTestQueueMessage).not.toHaveLength(0);
            expect(vcIssuedDetailType).toBe("VC_ISSUED");
            expect(vcIssuedSource).toBe("review-hc.localdev.account.gov.uk");
          });
        });
        describe("step function execution causes AuditEvent step function to receive published events", () => {
          jest.setTimeout(120_000);
          let txMaAuditEventTestQueue: CreateQueueCommandOutput;

          beforeEach(async () => {
            const [checkHmrcEventBus, txMaAuditEventRuleName] = (
              output.TxMaAuditEventRule as string
            ).split("|");
            txMaAuditEventTestQueue = await setUpQueueAndAttachToRule(
              output.TxMaAuditEventRuleArn as string,
              txMaAuditEventRuleName,
              checkHmrcEventBus
            );
          });
          afterEach(async () => {
            const [checkHmrcEventBus, txMaAuditEventRuleName] = (
              output.TxMaAuditEventRule as string
            ).split("|");
            txMaAuditEventTestQueue = await setUpQueueAndAttachToRule(
              output.TxMaAuditEventRuleArn as string,
              txMaAuditEventRuleName,
              checkHmrcEventBus
            );
            await retry(async () => {
              await removeTargetFromRule(
                targetId,
                checkHmrcEventBus,
                txMaAuditEventRuleName
              );
            });
            await retry(async () => {
              await deleteQueue(txMaAuditEventTestQueue.QueueUrl);
            });
          });
          it("should produce END and VC_ISSUED Events structure expected for the TxMA destination queue", async () => {
            const startExecutionResult =
              await getExecutionResult("Bearer unhappy");
            const txMaAuditEventTestQueueMessage = await getQueueMessages(
              txMaAuditEventTestQueue.QueueUrl as string
            );

            const txMaPayload = txMaAuditEventTestQueueMessage.map(
              (queueMessage) => JSON.parse(queueMessage.Body as string).detail
            );

            expect(startExecutionResult.output).toBeDefined();
            const expected = [
              {
                component_id: "https://review-hc.dev.account.gov.uk",
                event_name: "IPV_HMRC_RECORD_CHECK_CRI_END",
                event_timestamp_ms: expect.any(Number),
                timestamp: expect.any(Number),
                user: {
                  govuk_signin_journey_id:
                    "252561a2-c6ef-47e7-87ab-93891a2a6a41",
                  ip_address: "00.100.8.20",
                  persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
                  session_id: "issue-credential-happy",
                  user_id: "test",
                },
              },
              {
                component_id: "https://review-hc.dev.account.gov.uk",
                event_name: "IPV_HMRC_RECORD_CHECK_CRI_VC_ISSUED",
                event_timestamp_ms: expect.any(Number),
                extensions: {
                  evidence: [
                    {
                      attemptNum: 2,
                      ciReasons: [
                        {
                          ci: expect.any(String),
                          reason: expect.any(String),
                        },
                      ],
                      failedCheckDetails: [
                        { checkMethod: "data", dataCheck: "record_check" },
                      ],
                      txn: expect.any(String),
                      type: "IdentityCheck",
                    },
                  ],
                },
                restricted: {
                  birthDate: [{ value: "1948-04-23" }],
                  name: [
                    {
                      nameParts: [
                        { type: "GivenName", value: "Jim" },
                        { type: "FamilyName", value: "Ferguson" },
                      ],
                    },
                  ],
                  socialSecurityRecord: [{ personalNumber: "AA000003D" }],
                },
                timestamp: expect.any(Number),
                user: {
                  govuk_signin_journey_id:
                    "252561a2-c6ef-47e7-87ab-93891a2a6a41",
                  ip_address: "00.100.8.20",
                  persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
                  session_id: "issue-credential-happy",
                  user_id: "test",
                },
              },
            ];
            expect(txMaPayload).toContainEqual(expected[0]);
            expect(txMaPayload).toContainEqual(expected[1]);
          });
        });
      });
    });
  });

  const getExecutionResult = async (token: string) =>
    executeStepFunction(output.NinoIssueCredentialStateMachineArn as string, {
      bearerToken: token,
    });

  const isValidTimestamp = (timestamp: number) =>
    !isNaN(new Date(timestamp).getTime());

  const base64decode = (value: string) =>
    Buffer.from(value, "base64").toString("utf-8");

  const createSigningPublicJWK = async (
    kid: string,
    alg: string
  ): Promise<JWK> => {
    const publicKey = await getPublicKey(kid as string);
    const key = Buffer.from(publicKey as unknown as Uint8Array);

    const signingPublicJwk = createPublicKey({
      key,
      type: "spki",
      format: "der",
    }).export({ format: "jwk" });

    return {
      ...signingPublicJwk,
      use: "sig",
      kid,
      alg,
    };
  };

  const getBaseVcCredential = async () => {
    const issuer = await getSSMParameter(
      `/${output.CommonStackName}/verifiable-credential/issuer`
    );
    return {
      iss: `${issuer}`,
      jti: expect.any(String),
      nbf: expect.any(Number),
      exp: expect.any(Number),
      sub: "test",
      vc: {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
        ],
        credentialSubject: {
          name: [
            {
              nameParts: [
                { type: "GivenName", value: "Jim" },
                { type: "FamilyName", value: "Ferguson" },
              ],
            },
          ],
          birthDate: [
            {
              value: "1948-04-23",
            },
          ],
          socialSecurityRecord: [{ personalNumber: "AA000003D" }],
        },
        type: ["VerifiableCredential", "IdentityCheckCredential"],
      },
    };
  };

  const aVcWithCheckDetails = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            checkDetails: [{ checkMethod: "data" }],
            strengthScore: 2,
            txn: expect.any(String),
            type: "IdentityCheck",
            validityScore: 2,
          },
        ],
      },
    };
  };

  const aVcWithCheckDetailsDataCheck = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            checkDetails: [{ checkMethod: "data", dataCheck: "record_check" }],
            txn: expect.any(String),
            type: "IdentityCheck",
          },
        ],
      },
    };
  };

  const aVcWithFailedCheckDetailsRecordCheck = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            failedCheckDetails: [
              { checkMethod: "data", dataCheck: "record_check" },
            ],
            txn: expect.any(String),
            type: "IdentityCheck",
          },
        ],
      },
    };
  };

  const aVcWithFailedCheckDetailsAndCi = async () => {
    const { vc: customClaims, ...standardClaims } = await getBaseVcCredential();
    return {
      ...standardClaims,
      vc: {
        ...customClaims,
        evidence: [
          {
            failedCheckDetails: [{ checkMethod: "data" }],
            ci: [expect.any(String)],
            strengthScore: 2,
            txn: expect.any(String),
            type: "IdentityCheck",
            validityScore: 0,
          },
        ],
      },
    };
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
  });
});
