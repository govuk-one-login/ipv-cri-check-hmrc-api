import { SessionItem } from "../../../common/src/database/types/session-item";
import { AttemptItem, AttemptsResult } from "../../../common/src/types/attempt";
import { getEvidence, getAuditEvidence } from "../../src/evidence/evidence-creator";
import * as MetricsUtils from "../../../common/src/util/metrics";
import { CHECK_DETAIL } from "../../../common/src/types/evidence";

describe("evidence-creator", () => {
  const sessionId = "test-session";
  const passedAttempt = {
    count: 1,
    successCount: 1,
    items: [{ sessionId, attempt: "PASS", status: "200" } as AttemptItem],
    passedItems: [{ sessionId, attempt: "PASS", status: "200" } as AttemptItem],
  } as AttemptsResult;
  const failedAttempt = {
    count: 2,
    items: [
      {
        sessionId,
        attempt: "FAIL",
        text: "failed check 1, failed check 2",
      } as AttemptItem,
      {
        sessionId,
        attempt: "FAIL",
        text: "failed check 1, failed check 2",
      } as AttemptItem,
    ],
  } as AttemptsResult;

  const evidenceRequest = {
    scoringPolicy: "gpg45",
    strengthScore: 2,
  };

  describe("getEvidence", () => {
    it("creates evidence with checkDetails when user has passed with score 2 and strength 2", () => {
      const session = {
        sessionId: "test-session",
        txn: "mock-txn",
        evidenceRequest,
      } as SessionItem;

      const result = getEvidence(session, passedAttempt, CHECK_DETAIL, []);

      expect(result).toEqual({
        checkDetails: [{ checkMethod: "data" }],
        strengthScore: 2,
        txn: "mock-txn",
        type: "IdentityCheck",
        validityScore: 2,
      });
    });

    it("creates evidence with failedCheckDetails and ci empty when user has failed with score 0 and strength 2", () => {
      const session = {
        sessionId: "test-session",
        txn: "mock-txn",
        evidenceRequest,
      };

      const result = getEvidence(session, failedAttempt, CHECK_DETAIL, []);

      expect(result).toEqual({
        ci: [],
        failedCheckDetails: [{ checkMethod: "data" }],
        strengthScore: 2,
        txn: "mock-txn",
        type: "IdentityCheck",
        validityScore: 0,
      });
    });

    it("creates evidence with failedCheckDetails and ci with values when user has failed with score 0 and strength 2", () => {
      const session = {
        sessionId: "test-session",
        txn: "mock-txn",
        evidenceRequest,
      };

      const result = getEvidence(session, failedAttempt, CHECK_DETAIL, [
        {
          ci: "ci_3",
          reason: "ci_3 reason",
        },
      ]);

      expect(result).toEqual({
        ci: ["ci_3"],
        failedCheckDetails: [{ checkMethod: "data" }],
        strengthScore: 2,
        txn: "mock-txn",
        type: "IdentityCheck",
        validityScore: 0,
      });
    });
  });

  describe("getAuditEvidence", () => {
    it("creates audit evidence with checkDetails when user has passed", () => {
      const evidence = getEvidence(
        {
          sessionId: "test-session",
          txn: "mock-txn",
          evidenceRequest,
        },
        passedAttempt,
        CHECK_DETAIL,
        []
      );

      const result = getAuditEvidence(passedAttempt, [], evidence);

      expect(result).toEqual({
        attemptNum: 1,
        checkDetails: [{ checkMethod: "data" }],
        strengthScore: 2,
        txn: "mock-txn",
        type: "IdentityCheck",
        validityScore: 2,
      });
    });

    it("creates audit evidence with failedCheckDetails and ciReasons when user has failed", () => {
      const captureMetricSpy = jest.spyOn(MetricsUtils, "captureMetric");
      const contraIndicators = [
        {
          ci: "ci_3",
          reason: "ci_3 reason",
        },
      ];
      const evidence = getEvidence(
        {
          sessionId: "test-session",
          txn: "mock-txn",
          evidenceRequest,
        },
        failedAttempt,
        CHECK_DETAIL,
        contraIndicators
      );

      const result = getAuditEvidence(failedAttempt, contraIndicators, evidence);

      expect(result).toEqual({
        attemptNum: 2,
        ci: ["ci_3"],
        ciReasons: [{ ci: "ci_3", reason: "ci_3 reason" }],
        failedCheckDetails: [{ checkMethod: "data" }],
        strengthScore: 2,
        txn: "mock-txn",
        type: "IdentityCheck",
        validityScore: 0,
      });
      expect(captureMetricSpy).toHaveBeenCalledWith("CIRaisedMetric");
    });
  });
});
