export interface MatchEvent {
  sessionId: string;
  nino: string;
  userDetails: {
    firstName: string;
    lastName: string;
    dob: string;
    nino: string;
  };
  userAgent: string;
  apiURL: string;
  oAuthToken: string;
  user: { govuk_signin_journey_id: string };
}
