export interface SessionItem {
  sessionId: string;
  clientSessionId: string;
  clientIpAddress: string;
  subject: string;
  clientId: string;
  expiryDate: string;
  persistentSessionId?: string;
}
