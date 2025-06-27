import { UnixTimestamp } from "../../../../common/src/types/brands";

export type OtgTokenResponse = {
  token: string;
  expiry: UnixTimestamp;
};

export type OtgConfig = { apiUrl: string };
