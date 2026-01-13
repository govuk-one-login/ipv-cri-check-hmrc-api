import { UnixSecondsTimestamp } from "../../types/brands";

export type OtgTokenResponse = {
  token: string;
  expiry: UnixSecondsTimestamp;
};

export type OtgConfig = { apiUrl: string };
