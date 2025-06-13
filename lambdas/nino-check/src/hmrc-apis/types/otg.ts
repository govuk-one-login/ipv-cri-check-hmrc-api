import { UnixTimestamp } from "./brands";

export type OtgTokenResponse = {
  token: string;
  expiry: UnixTimestamp;
};
