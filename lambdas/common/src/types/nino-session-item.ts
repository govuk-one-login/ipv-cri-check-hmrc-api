import { SessionItem } from "../database/types/session-item";

export type NinoSessionItem = SessionItem & {
  txn?: string;
};
