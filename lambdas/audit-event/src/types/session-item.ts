export interface SessionItem {
  expiryDate: number;
  sessionId: string;
  clientId: string;
  clientSessionId: string;
  clientIpAddress: string;
  persistentSessionId: string;
  authorizationCode?: string;
  authorizationCodeExpiryDate: number;
  redirectUri: string;
  accessToken: string;
  accessTokenExpiryDate: number;
  subject: string;
}
