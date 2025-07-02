import { UnixSecondsTimestamp } from "../../types/brands";

export type RecordWithExpiry =
  | { expiryDate: UnixSecondsTimestamp; ttl?: null }
  | { ttl: UnixSecondsTimestamp; expiryDate?: null };

export function isRecordExpired(record: RecordWithExpiry) {
  if (!record.expiryDate && !record.ttl) {
    throw new Error(`Record must have a valid expiry date!`);
  }

  // expiryDate is in Unix seconds, not milliseconds
  const now = Math.floor(Date.now() / 1000);
  return now > (record.expiryDate ?? record.ttl);
}
