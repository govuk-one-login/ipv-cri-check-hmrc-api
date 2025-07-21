import { NinoSessionItem } from "./nino-session-item";

export type EvidenceRequest = {
  scoringPolicy?: string;
  strengthScore?: number;
  validityScore?: number;
  verificationScore?: number;
  activityHistoryScore?: number;
  identityFraudScore?: number;
};

export type NinoIssueSessionItem = NinoSessionItem & {
  evidenceRequest: EvidenceRequest;
};
