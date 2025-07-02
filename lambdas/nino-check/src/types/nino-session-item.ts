import { SessionItem } from "../../../common/src/database/types/session-item";

export type NinoSessionItem = SessionItem & {
  txn: string;
};
