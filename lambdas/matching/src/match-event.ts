interface MatchEvent {
  sessionId: string;
  nino: string;
  userDetails: {
    Items: [
      {
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
      }
    ];
  };
  userAgent: {
    value: string;
  };
  apiURL: {
    value: string;
  };
  oAuthToken: {
    value: string;
  };
}
