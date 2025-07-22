import { UnixSecondsTimestamp } from "../../types/brands";

export interface SessionItem {
  expiryDate: UnixSecondsTimestamp;
  sessionId: string;
  clientId: string;
  clientSessionId: string;
  authorizationCode?: string;
  authorizationCodeExpiryDate: number;
  redirectUri: string;
  accessToken: string;
  accessTokenExpiryDate: number;
  clientIpAddress: string;
  subject: string;
  persistentSessionId?: string;
  txn?: string;
  evidenceRequest?: EvidenceRequest;
}
export type EvidenceRequest = {
  scoringPolicy?: string;
  strengthScore?: number;
  validityScore?: number;
  verificationScore?: number;
  activityHistoryScore?: number;
  identityFraudScore?: number;
};
