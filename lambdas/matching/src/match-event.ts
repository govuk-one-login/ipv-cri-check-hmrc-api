export interface MatchEvent {
  sessionId: string;
  nino: string;
  userDetails: {
    firstName: {
      S: string;
    };
    lastName: {
      S: string;
    };
    dob: {
      S: string;
    };
    nino: {
      S: string;
    };
  };
  userAgent: string;
  apiURL: string;
  oAuthToken: string;
}
