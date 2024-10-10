import { Names } from "./name-part";

export interface MatchEvent {
  sessionId: string;
  nino: string;
  userDetails: {
    names: Names;
    dob: string;
    nino: string;
  };
  userAgent: string;
  apiURL: string;
  oAuthToken: string;
  user: { govuk_signin_journey_id: string };
}
