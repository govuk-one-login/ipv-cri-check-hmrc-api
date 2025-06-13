export function isRecordExpired(record: { expiryDate?: number }) {
  if ("expiryDate" in record) {
    // expiryDate is in Unix seconds, not milliseconds
    const now = Math.floor(Date.now() / 1000);
    return now > (record.expiryDate ?? 0);
  }
  return false;
}
