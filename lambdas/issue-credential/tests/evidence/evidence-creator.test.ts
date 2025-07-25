import { SessionItem } from "../../../common/src/database/types/session-item";
import { AttemptItem, AttemptsResult } from "../../../common/src/types/attempt";
import { getEvidence, getAuditEvidence, getCheckDetail } from "../../src/evidence/evidence-creator";

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

  describe("getEvidence", () => {
    describe("Identity Check", () => {
      const evidenceRequest = {
        scoringPolicy: "gpg45",
        strengthScore: 2,
      };

      it("creates evidence with checkDetails when user has passed with score 2 and strength 2", () => {
        const session = {
          sessionId: "test-session",
          txn: "mock-txn",
          evidenceRequest,
        } as SessionItem;

        const result = getEvidence(session, passedAttempt, getCheckDetail(evidenceRequest), []);

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

        const result = getEvidence(session, failedAttempt, getCheckDetail(evidenceRequest), []);

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

        const result = getEvidence(session, failedAttempt, getCheckDetail(evidenceRequest), [
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

    describe("Record Check", () => {
      it("creates evidence with checkDetails and dataCheck when user has passed without any scores", () => {
        const session = {
          sessionId: "test-session",
          txn: "mock-txn",
        };

        const result = getEvidence(session, passedAttempt, getCheckDetail(), []);

        expect(result).toEqual({
          checkDetails: [{ checkMethod: "data", dataCheck: "record_check" }],
          txn: "mock-txn",
          type: "IdentityCheck",
        });
      });

      it("creates evidence with failedCheckDetails and dataCheck when user failed without any scores", () => {
        const session = {
          sessionId: "test-session",
          txn: "mock-txn",
        };

        const result = getEvidence(session, failedAttempt, getCheckDetail(), []);

        expect(result).toEqual({
          failedCheckDetails: [{ checkMethod: "data", dataCheck: "record_check" }],
          txn: "mock-txn",
          type: "IdentityCheck",
        });
      });
    });
  });

  describe("getAuditEvidence", () => {
    describe("Identity Check", () => {
      const evidenceRequest = {
        scoringPolicy: "gpg45",
        strengthScore: 2,
      };

      it("creates audit evidence with checkDetails when user has passed", () => {
        const session = {
          sessionId: "test-session",
          txn: "mock-txn",
          evidenceRequest,
        };

        const result = getAuditEvidence(session, passedAttempt, getCheckDetail(evidenceRequest), []);

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
        const session = {
          sessionId: "test-session",
          txn: "mock-txn",
          evidenceRequest,
        };

        const result = getAuditEvidence(session, failedAttempt, getCheckDetail(evidenceRequest), [
          {
            ci: "ci_3",
            reason: "ci_3 reason",
          },
        ]);

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
      });
    });

    describe("Record Check", () => {
      it("creates audit evidence with checkDetails without scores when user has passed", () => {
        const session = {
          sessionId: "test-session",
          txn: "mock-txn",
        };

        const result = getAuditEvidence(session, passedAttempt, getCheckDetail(), []);

        expect(result).toEqual({
          checkDetails: [{ checkMethod: "data", dataCheck: "record_check" }],
          txn: "mock-txn",
          type: "IdentityCheck",
        });
      });
    });
  });

  describe("getCheckDetail", () => {
    it("returns checkMethod data and dataCheck record_check when no evidenceRequest", () => {
      const result = getCheckDetail();
      expect(result).toEqual({
        checkMethod: "data",
        dataCheck: "record_check",
      });
    });

    it("returns only checkMethod data when evidenceRequest exists", () => {
      const evidenceRequest = {
        scoringPolicy: "gpg45",
        strengthScore: 2,
      };
      const result = getCheckDetail(evidenceRequest);
      expect(result).toEqual({
        checkMethod: "data",
      });
    });
  });
});
