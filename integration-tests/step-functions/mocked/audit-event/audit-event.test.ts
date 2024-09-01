import { HistoryEvent } from "@aws-sdk/client-sfn";
import { SfnContainerHelper } from "./sfn-container-helper";

jest.setTimeout(60_000);

const userInfoEvent = {
  Count: 1,
  Items: [
    {
      names: {
        L: [
          {
            M: {
              nameParts: {
                L: [
                  {
                    M: {
                      type: {
                        S: "GivenName",
                      },
                      value: {
                        S: "Jim",
                      },
                    },
                  },
                  {
                    M: {
                      type: {
                        S: "FamilyName",
                      },
                      value: {
                        S: "Ferguson",
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      sessionId: {
        S: "issue-credential-happy",
      },
      birthDates: {
        L: [
          {
            M: {
              value: {
                S: "1948-04-23",
              },
            },
          },
        ],
      },
      nino: {
        S: "AA000003D",
      },
    },
  ],
  ScannedCount: 1,
};
const user = {
  govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
  user_id: "test",
  persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
  session_id: "issue-credential-happy-publish",
  ip_address: "00.100.8.20",
};

describe("Audit events", () => {
  let sfnContainer: SfnContainerHelper;

  beforeAll(async () => {
    sfnContainer = new SfnContainerHelper();
  });

  afterAll(async () => sfnContainer.shutDown());

  it("has a step-function docker container running", async () => {
    expect(sfnContainer.getContainer()).toBeDefined();
  });

  describe("user context", () => {
    it("should add user section and create audit event", async () => {
      const input = JSON.stringify({
        "detail-type": "EVENT_NAME",
        source: "review-hc.localdev.account.gov.uk",
        detail: {
          auditPrefix: "AUDIT_EVENT_PREFIX",
          user,
          issuer: "https://review-hc.dev.account.gov.uk",
        },
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const [_, noRestrictedInfo, auditUserContext, objectToPublish] =
        await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );

      expect(noRestrictedInfo.stateExitedEventDetails?.name).toBe(
        "AuditEvent Without Restricted Info"
      );
      expect(auditUserContext.stateExitedEventDetails?.name).toBe(
        "Add User Context"
      );
      const result = JSON.parse(
        objectToPublish.executionSucceededEventDetails?.output as string
      );
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditEvent: {
              component_id: "https://review-hc.dev.account.gov.uk",
              event_timestamp_ms: 1716162264134,
              event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
              user: {
                govuk_signin_journey_id: "252561a2-c6ef-47e7-87ab-93891a2a6a41",
                user_id: "test",
                persistent_session_id: "156714ef-f9df-48c2-ada8-540e7bce44f7",
                session_id: "issue-credential-happy-publish",
                ip_address: "00.100.8.20",
              },
              timestamp: 1716162264,
            },
          }),
        ])
      );
    });

    it("should include extension with evidence supplied", async () => {
      const input = JSON.stringify({
        "detail-type": "EVENT_NAME",
        source: "review-hc.localdev.account.gov.uk",
        detail: {
          auditPrefix: "AUDIT_EVENT_PREFIX",
          user,
          issuer: "https://review-hc.dev.account.gov.uk",
          evidence: [{ ci: "some ci", ciReasons: "some reason for ci" }],
        },
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const [_, noRestrictedInfo, auditUserContext, objectToPublish] =
        await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );

      expect(noRestrictedInfo.stateExitedEventDetails?.name).toBe(
        "AuditEvent Without Restricted Info"
      );
      expect(auditUserContext.stateExitedEventDetails?.name).toBe(
        "Audit Event With Evidence & Restricted Info"
      );
      const result = JSON.parse(
        objectToPublish.executionSucceededEventDetails?.output as string
      );
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditEvent: {
              event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
              component_id: "https://review-hc.dev.account.gov.uk",
              extensions: {
                evidence: [{ ci: "some ci", ciReasons: "some reason for ci" }],
              },
              user,
              event_timestamp_ms: 1716162264134,
              timestamp: 1716162264,
            },
          }),
        ])
      );
    });

    it("should include extension with evidence when txn has a value", async () => {
      const input = JSON.stringify({
        "detail-type": "EVENT_NAME",
        source: "review-hc.localdev.account.gov.uk",
        detail: {
          auditPrefix: "AUDIT_EVENT_PREFIX",
          user,
          issuer: "https://review-hc.dev.account.gov.uk",
          evidence: [{ txn: "mock-txn" }],
        },
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const [_, noRestrictedInfo, auditUserContext, objectToPublish] =
        await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );

      expect(noRestrictedInfo.stateExitedEventDetails?.name).toBe(
        "AuditEvent Without Restricted Info"
      );
      expect(auditUserContext.stateExitedEventDetails?.name).toBe(
        "Audit Event With Evidence & Restricted Info"
      );
      const result = JSON.parse(
        objectToPublish.executionSucceededEventDetails?.output as string
      );
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditEvent: {
              event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
              component_id: "https://review-hc.dev.account.gov.uk",
              extensions: {
                evidence: [{ txn: "mock-txn" }],
              },
              user,
              event_timestamp_ms: 1716162264134,
              timestamp: 1716162264,
            },
          }),
        ])
      );
    });

    it("should not include extension with evidence when evidence only contains a txn with blank value", async () => {
      const input = JSON.stringify({
        "detail-type": "EVENT_NAME",
        source: "review-hc.localdev.account.gov.uk",
        detail: {
          auditPrefix: "AUDIT_EVENT_PREFIX",
          user,
          issuer: "https://review-hc.dev.account.gov.uk",
          evidence: [{ txn: "" }],
        },
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const [_, noRestrictedInfo, auditUserContext, objectToPublish] =
        await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );

      expect(noRestrictedInfo.stateExitedEventDetails?.name).toBe(
        "AuditEvent Without Restricted Info"
      );
      expect(auditUserContext.stateExitedEventDetails?.name).toBe(
        "Add User Context"
      );
      const result = JSON.parse(
        objectToPublish.executionSucceededEventDetails?.output as string
      );
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditEvent: {
              event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
              component_id: "https://review-hc.dev.account.gov.uk",
              user,
              event_timestamp_ms: 1716162264134,
              timestamp: 1716162264,
            },
          }),
        ])
      );
    });

    it("should not include extension with evidence when evidence contains a txn with blank value", async () => {
      const input = JSON.stringify({
        "detail-type": "EVENT_NAME",
        source: "review-hc.localdev.account.gov.uk",
        detail: {
          auditPrefix: "AUDIT_EVENT_PREFIX",
          user,
          issuer: "https://review-hc.dev.account.gov.uk",
          evidence: [
            { txn: "", ci: "some ci", ciReasons: "some reason for ci" },
          ],
        },
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const [_, noRestrictedInfo, auditUserContext, objectToPublish] =
        await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );

      expect(noRestrictedInfo.stateExitedEventDetails?.name).toBe(
        "AuditEvent Without Restricted Info"
      );
      expect(auditUserContext.stateExitedEventDetails?.name).toBe(
        "Add User Context"
      );
      const result = JSON.parse(
        objectToPublish.executionSucceededEventDetails?.output as string
      );
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditEvent: {
              event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
              component_id: "https://review-hc.dev.account.gov.uk",
              user,
              event_timestamp_ms: 1716162264134,
              timestamp: 1716162264,
            },
          }),
        ])
      );
    });

    it("should include extension encoded section when header field with a value is present", async () => {
      const input = JSON.stringify({
        "detail-type": "EVENT_NAME",
        source: "review-hc.localdev.account.gov.uk",
        detail: {
          auditPrefix: "AUDIT_EVENT_PREFIX",
          deviceInformation: "test encoded header",
          user,
          issuer: "https://review-hc.dev.account.gov.uk",
        },
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const [_, setDeviceInfo, restrictedInfo, auditUserContext, result] =
        await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );
      expect(setDeviceInfo.stateExitedEventDetails?.name).toBe(
        "Format Device Information"
      );
      expect(restrictedInfo.stateExitedEventDetails?.name).toBe(
        "Add Restricted Info to AuditEvent"
      );
      expect(auditUserContext.stateExitedEventDetails?.name).toBe(
        "Add User Context"
      );
      const objectToPublish = JSON.parse(
        result.executionSucceededEventDetails?.output as string
      );
      expect(objectToPublish).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditEvent: {
              component_id: "https://review-hc.dev.account.gov.uk",
              event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
              event_timestamp_ms: 1716162264134,
              restricted: {
                device_information: { encoded: "test encoded header" },
              },
              timestamp: 1716162264,
              user,
            },
          }),
        ])
      );
    });

    it("should exclude extension encoded section when header field with a value {} is present", async () => {
      const input = JSON.stringify({
        "detail-type": "EVENT_NAME",
        source: "review-hc.localdev.account.gov.uk",
        detail: {
          auditPrefix: "AUDIT_EVENT_PREFIX",
          deviceInformation: "{}", // default returned by the CheckSession State machine when the header
          user,
          issuer: "https://review-hc.dev.account.gov.uk",
        },
      });
      const responseStepFunction =
        await sfnContainer.startStepFunctionExecution("Happy", input);
      const [_, setDefaultNoDevice, restrictedInfo, auditUserContext, result] =
        await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );
      expect(setDefaultNoDevice.stateExitedEventDetails?.name).toBe(
        "Set Default Value For Formatted Device Information"
      );
      expect(restrictedInfo.stateExitedEventDetails?.name).toBe(
        "Add Restricted Info to AuditEvent"
      );
      expect(auditUserContext.stateExitedEventDetails?.name).toBe(
        "Add User Context"
      );
      const objectToPublish = JSON.parse(
        result.executionSucceededEventDetails?.output as string
      );
      expect(objectToPublish).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditEvent: {
              component_id: "https://review-hc.dev.account.gov.uk",
              event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
              event_timestamp_ms: 1716162264134,
              restricted: {}, // ideally this should be present at all
              timestamp: 1716162264,
              user,
            },
          }),
        ])
      );
    });
    describe("personal data present", () => {
      it("should add restricted section when no evidence is supplied", async () => {
        const input = JSON.stringify({
          "detail-type": "EVENT_NAME",
          source: "review-hc.localdev.account.gov.uk",
          detail: {
            auditPrefix: "AUDIT_EVENT_PREFIX",
            user,
            userInfoEvent,
            nino: "AA000003D",
            issuer: "https://review-hc.dev.account.gov.uk",
          },
        });
        const responseStepFunction =
          await sfnContainer.startStepFunctionExecution(
            "HappyPersonalData",
            input
          );
        const [
          _,
          setDefaultNoDevice,
          restrictedInfo,
          auditUserContext,
          result,
        ] = await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );
        expect(setDefaultNoDevice.stateExitedEventDetails?.name).toBe(
          "Set Default Value For Formatted Device Information"
        );
        expect(restrictedInfo.stateExitedEventDetails?.name).toBe(
          "Add Restricted Info to AuditEvent"
        );
        expect(auditUserContext.stateExitedEventDetails?.name).toBe(
          "Add User Context"
        );
        const objectToPublish = JSON.parse(
          result.executionSucceededEventDetails?.output as string
        );
        expect(objectToPublish).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              auditEvent: {
                component_id: "https://review-hc.dev.account.gov.uk",
                event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
                event_timestamp_ms: 1716162264134,
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
                timestamp: 1716162264,
                user,
              },
            }),
          ])
        );
      });
      it("should add restricted section, includes extension when evidence is supplied", async () => {
        const input = JSON.stringify({
          "detail-type": "EVENT_NAME",
          source: "review-hc.localdev.account.gov.uk",
          detail: {
            auditPrefix: "AUDIT_EVENT_PREFIX",
            evidence: [
              {
                failedCheckDetails: [
                  {
                    checkMethod: "data",
                    dataCheck: "record_check",
                  },
                ],
                txn: "7888835e-07f7-414c-a9a0-62a55e551c2b",
                type: "IdentityCheck",
                attemptNum: 2,
                ciReasons: [
                  {
                    ci: "ci",
                    reason: "some ci reason",
                  },
                ],
              },
            ],
            user,
            userInfoEvent,
            issuer: "https://review-hc.dev.account.gov.uk",
            nino: "AA000003D",
          },
        });
        const responseStepFunction =
          await sfnContainer.startStepFunctionExecution(
            "HappyPersonalData",
            input
          );
        const [
          _,
          setDefaultNoDevice,
          restrictedInfo,
          auditUserContext,
          result,
        ] = await sfnContainer.waitFor(
          (event: HistoryEvent) =>
            event.type === "PassStateExited" ||
            event?.type == "ExecutionSucceeded",
          responseStepFunction
        );
        expect(setDefaultNoDevice.stateExitedEventDetails?.name).toBe(
          "Set Default Value For Formatted Device Information"
        );
        expect(restrictedInfo.stateExitedEventDetails?.name).toBe(
          "Add Restricted Info to AuditEvent"
        );
        expect(auditUserContext.stateExitedEventDetails?.name).toBe(
          "Audit Event With Evidence & Restricted Info"
        );
        const objectToPublish = JSON.parse(
          result.executionSucceededEventDetails?.output as string
        );
        expect(objectToPublish).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              auditEvent: {
                component_id: "https://review-hc.dev.account.gov.uk",
                event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
                event_timestamp_ms: 1716162264134,
                extensions: {
                  evidence: [
                    {
                      attemptNum: 2,
                      ciReasons: [{ ci: "ci", reason: "some ci reason" }],
                      failedCheckDetails: [
                        { checkMethod: "data", dataCheck: "record_check" },
                      ],
                      txn: "7888835e-07f7-414c-a9a0-62a55e551c2b",
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
                timestamp: 1716162264,
                user,
              },
            }),
          ])
        );
      });

      describe("Device Information header field is added", () => {
        it("should include device info value in extension encoded section when value is present", async () => {
          const input = JSON.stringify({
            "detail-type": "EVENT_NAME",
            source: "review-hc.localdev.account.gov.uk",
            detail: {
              auditPrefix: "AUDIT_EVENT_PREFIX",
              deviceInformation: "test encoded header",
              evidence: [
                {
                  failedCheckDetails: [
                    {
                      checkMethod: "data",
                      dataCheck: "record_check",
                    },
                  ],
                  txn: "7888835e-07f7-414c-a9a0-62a55e551c2b",
                  type: "IdentityCheck",
                  attemptNum: 2,
                  ciReasons: [
                    {
                      ci: "ci",
                      reason: "some ci reason",
                    },
                  ],
                },
              ],
              user,
              userInfoEvent,
              issuer: "https://review-hc.dev.account.gov.uk",
              nino: "AA000003D",
            },
          });
          const responseStepFunction =
            await sfnContainer.startStepFunctionExecution(
              "HappyPersonalData",
              input
            );
          const [_, setDeviceInfo, restrictedInfo, auditUserContext, result] =
            await sfnContainer.waitFor(
              (event: HistoryEvent) =>
                event.type === "PassStateExited" ||
                event?.type == "ExecutionSucceeded",
              responseStepFunction
            );
          expect(setDeviceInfo.stateExitedEventDetails?.name).toBe(
            "Format Device Information"
          );
          expect(restrictedInfo.stateExitedEventDetails?.name).toBe(
            "Add Restricted Info to AuditEvent"
          );
          expect(auditUserContext.stateExitedEventDetails?.name).toBe(
            "Audit Event With Evidence & Restricted Info"
          );
          const objectToPublish = JSON.parse(
            result.executionSucceededEventDetails?.output as string
          );
          expect(objectToPublish).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                auditEvent: {
                  component_id: "https://review-hc.dev.account.gov.uk",
                  event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
                  event_timestamp_ms: 1716162264134,
                  extensions: {
                    evidence: [
                      {
                        attemptNum: 2,
                        ciReasons: [{ ci: "ci", reason: "some ci reason" }],
                        failedCheckDetails: [
                          { checkMethod: "data", dataCheck: "record_check" },
                        ],
                        txn: "7888835e-07f7-414c-a9a0-62a55e551c2b",
                        type: "IdentityCheck",
                      },
                    ],
                  },
                  restricted: {
                    birthDate: [{ value: "1948-04-23" }],
                    device_information: { encoded: "test encoded header" },
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
                  timestamp: 1716162264,
                  user,
                },
              }),
            ])
          );
        });
        it("should exclude extension encoded section when value added is {}", async () => {
          const input = JSON.stringify({
            "detail-type": "EVENT_NAME",
            source: "review-hc.localdev.account.gov.uk",
            detail: {
              auditPrefix: "AUDIT_EVENT_PREFIX",
              deviceInformation: "{}",
              evidence: [
                {
                  failedCheckDetails: [
                    {
                      checkMethod: "data",
                      dataCheck: "record_check",
                    },
                  ],
                  txn: "7888835e-07f7-414c-a9a0-62a55e551c2b",
                  type: "IdentityCheck",
                  attemptNum: 2,
                  ciReasons: [
                    {
                      ci: "ci",
                      reason: "some ci reason",
                    },
                  ],
                },
              ],
              user,
              userInfoEvent,
              issuer: "https://review-hc.dev.account.gov.uk",
              nino: "AA000003D",
            },
          });
          const responseStepFunction =
            await sfnContainer.startStepFunctionExecution(
              "HappyPersonalData",
              input
            );
          const [
            _,
            setDefaultNoDevice,
            restrictedInfo,
            auditUserContext,
            result,
          ] = await sfnContainer.waitFor(
            (event: HistoryEvent) =>
              event.type === "PassStateExited" ||
              event?.type == "ExecutionSucceeded",
            responseStepFunction
          );
          expect(setDefaultNoDevice.stateExitedEventDetails?.name).toBe(
            "Set Default Value For Formatted Device Information"
          );
          expect(restrictedInfo.stateExitedEventDetails?.name).toBe(
            "Add Restricted Info to AuditEvent"
          );
          expect(auditUserContext.stateExitedEventDetails?.name).toBe(
            "Audit Event With Evidence & Restricted Info"
          );
          const objectToPublish = JSON.parse(
            result.executionSucceededEventDetails?.output as string
          );
          expect(objectToPublish).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                auditEvent: {
                  component_id: "https://review-hc.dev.account.gov.uk",
                  event_name: "AUDIT_EVENT_PREFIX_EVENT_NAME",
                  event_timestamp_ms: 1716162264134,
                  extensions: {
                    evidence: [
                      {
                        attemptNum: 2,
                        ciReasons: [{ ci: "ci", reason: "some ci reason" }],
                        failedCheckDetails: [
                          { checkMethod: "data", dataCheck: "record_check" },
                        ],
                        txn: "7888835e-07f7-414c-a9a0-62a55e551c2b",
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
                  timestamp: 1716162264,
                  user,
                },
              }),
            ])
          );
        });
      });
    });
  });
});
