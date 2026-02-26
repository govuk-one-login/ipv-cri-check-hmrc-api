import { UnixSecondsTimestamp } from "@govuk-one-login/cri-types";

export type OtgTokenResponse = {
  token: string;
  expiry: UnixSecondsTimestamp;
};

export type OtgConfig = { apiUrl: string };
