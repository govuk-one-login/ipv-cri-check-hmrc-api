import { UnixSecondsTimestamp } from "../../../../common/src/types/brands";

export type OtgTokenResponse = {
  token: string;
  expiry: UnixSecondsTimestamp;
};

export type OtgConfig = { apiUrl: string };
